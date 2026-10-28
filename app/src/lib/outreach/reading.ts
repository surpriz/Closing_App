import { isDeepRead } from "@/lib/closing/dashboard/funnel";
import { hasReason } from "@/lib/closing/engagement/reasons";
import { generateFollowupMessage, OPEN_FOLLOWUP_STATUSES, queueFollowup } from "@/lib/closing/followups/queue";
import { notifySeller } from "@/lib/closing/notify/notify";
import { habitualSendHour, nextSendSlot } from "@/lib/closing/scheduling/send-time";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { readingOfLink } from "@/lib/closing/shared/reading-time";
import { prisma } from "@/lib/db";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { dedupeKeyOf, scheduleStepMessage, type StepRow } from "./messages";
import { releaseCampaignLink } from "./ownership";
import { businessHoursOf, nextStepFor, stepSendAt, type NextAction } from "./planner";
import { organizationWhere, type OutreachScope } from "./scope";
import { signalsFrom } from "./signals";

/** A reader still on the page is not evaluated: the tick waits until the reading has settled. */
const SETTLE_MS = 5 * 60 * 1000;
const TICK_BATCH = 100;
const STEP_SELECT = {
  id: true,
  order: true,
  delayDays: true,
  subject: true,
  newThread: true,
  body: true,
  carriesLink: true,
} as const;
/** An enrollment paused by a reading signal can still hear about a stronger one; any other pause is left alone. */
const READING_PAUSES = ["call_moment", "deep_read"];

type Trigger = "COLD_READ_PRICING" | "COLD_READ" | "COLD_REACTIVATE";

/**
 * Reads the signals of a campaign link and applies what the planner decides (E2, E3, E5, E6). Null when the link
 * does not belong to a live enrollment of an ACTIVE campaign. Idempotent: every write is conditional or deduped.
 */
export async function evaluateEnrollmentReading(linkId: string, now: Date): Promise<NextAction["kind"] | null> {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      documentId: true,
      campaignProspectId: true,
      createdBy: { select: { locale: true } },
      document: { select: { numPages: true } },
      engagementScore: { select: { reasons: true } },
    },
  });
  if (!link?.campaignProspectId) return null;
  const enrollment = await prisma.campaignProspect.findUnique({
    where: { id: link.campaignProspectId },
    include: { campaign: { select: { id: true, status: true, mailboxId: true, steps: { orderBy: { order: "asc" }, select: STEP_SELECT } } } },
  });
  if (!enrollment || (enrollment.status !== "ACTIVE" && enrollment.status !== "PAUSED")) return null;
  if (enrollment.campaign.status !== "ACTIVE") return null;
  const paused = enrollment.status === "PAUSED";
  if (paused && !READING_PAUSES.includes(enrollment.pausedReason ?? "")) return null;

  const [reading, views, forwards, sent, openFollowups, settings] = await Promise.all([
    readingOfLink(link.id, link.documentId),
    prisma.documentView.findMany({
      where: { linkId: link.id, isBot: false },
      select: { startedAt: true, lastSeenAt: true, isBot: true, totalDurationMs: true, maxPageReached: true },
    }),
    prisma.linkForward.findMany({ where: { linkId: link.id }, select: { toProspect: { select: { email: true } } } }),
    prisma.campaignMessage.findMany({
      where: { enrollmentId: enrollment.id, status: "SENT", sentAt: { not: null } },
      select: { sentAt: true, kind: true },
    }),
    prisma.followup.count({
      where: { campaignProspectId: enrollment.id, status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
    }),
    getWorkspaceSettings(enrollment.organizationId),
  ]);

  const deepRead = isDeepRead({
    numPages: link.document.numPages,
    viewCount: views.length,
    maxPageReached: views.reduce((max, view) => Math.max(max, view.maxPageReached), 0),
    totalDurationMs: views.reduce((sum, view) => sum + view.totalDurationMs, 0),
    pricingFocus: hasReason(link.engagementScore?.reasons, "pricing_focus"),
    validated: false,
  });
  const sentMessages = sent.flatMap((message) => (message.sentAt ? [{ sentAt: message.sentAt, kind: message.kind }] : []));
  const signals = signalsFrom({
    reading,
    views,
    deepRead,
    forwards: forwards.map((forward) => ({ toEmail: forward.toProspect.email })),
    enrollment,
    sent: sentMessages,
    openFollowup: openFollowups > 0,
    now,
  });
  const lastSentAt = signals.lastSentAt;

  // A paused enrollment is planned as an active one, but only the signal rows (alert, note) are applied to it
  const action = nextStepFor({
    enrollment: { status: "ACTIVE", currentStep: enrollment.currentStep, lastSentAt },
    steps: enrollment.campaign.steps,
    signals,
    settings: {
      minDelayAfterReadingHours: settings.minDelayAfterReadingHours,
      maxFollowupsPer30Days: settings.maxFollowupsPer30Days,
      minDaysBetweenFollowups: settings.minDaysBetweenFollowups,
      hotPricingThresholdSec: settings.hotPricingThresholdSec,
    },
    now,
  });
  const hours = businessHoursOf(settings);

  const prospect = await prisma.prospect.findFirst({
    where: enrollment.prospectId ? { id: enrollment.prospectId } : { linkId: link.id, origin: "CAMPAIGN" },
    select: { id: true, timezone: true },
  });
  const timezone = prospect?.timezone ?? enrollment.timezone;

  const queueRead = async (trigger: Trigger, mode: "asap" | "next-morning", key: string) => {
    if (!prospect) return;
    const hour = await habitualSendHour({
      prospectId: prospect.id,
      organizationId: enrollment.organizationId,
      timeZone: timezone,
      hours,
      now,
    });
    const followupId = await queueFollowup({
      linkId: link.id,
      prospectId: prospect.id,
      trigger,
      channel: "EMAIL",
      scheduledFor: nextSendSlot(now, timezone, hours, mode, hour, `cold:${enrollment.id}:${key}`),
      timezone,
      locale: enrollment.locale,
      dedupeKey: `cold:${enrollment.id}:read:${key}`,
      context: { readTags: signals.readTags, campaignProspectId: enrollment.id },
      campaignProspectId: enrollment.id,
    });
    if (followupId) await generateFollowupMessage(followupId);
  };

  if (action.kind === "pause_alert") {
    const lastSignal = action.reason === "call_moment" ? "pricing" : "deep";
    if (paused) {
      await prisma.campaignProspect.updateMany({ where: { id: enrollment.id, status: "PAUSED" }, data: { lastSignal } });
    } else {
      await prisma.campaignProspect.updateMany({
        where: { id: enrollment.id, status: "ACTIVE" },
        data: { status: "PAUSED", pausedReason: action.reason, pausedAt: now, lastSignal },
      });
    }
    const t = getNamespaceTranslator(toUiLocale(link.createdBy?.locale), "alerts.callMoment");
    await notifySeller({
      linkId: link.id,
      type: "CALL_MOMENT",
      dedupeKey: `cold_call:${link.id}:${action.reason}`,
      payload: { reason: t(action.reason === "call_moment" ? "campaignPricing" : "campaignDeepRead") },
      now,
    });
    if (action.followup) await queueRead(action.followup, "next-morning", action.followup === "COLD_READ_PRICING" ? "pricing" : "deep");
  } else if (action.kind === "note_forward") {
    await prisma.campaignProspect.updateMany({
      where: { id: enrollment.id, status: enrollment.status },
      data: { lastSignal: "forward" },
    });
  } else if (!paused && action.kind === "ai_followup") {
    await queueRead(action.trigger, "asap", "reactivate");
    await prisma.campaignProspect.updateMany({
      where: { id: enrollment.id, status: "ACTIVE" },
      data: { reactivatedAt: now, lastSignal: "reactivate" },
    });
  } else if (!paused && action.kind === "send_step" && enrollment.campaign.mailboxId) {
    const step: StepRow = enrollment.campaign.steps.find((s) => s.id === action.step.id)!;
    const at = stepSendAt(action.earliest, enrollment.timezone, hours, dedupeKeyOf(enrollment.id, step.id));
    const scheduled = await scheduleStepMessage({
      enrollment,
      step,
      campaignId: enrollment.campaign.id,
      mailboxId: enrollment.campaign.mailboxId,
      scheduledFor: at,
    });
    if ("id" in scheduled) {
      await prisma.campaignProspect.updateMany({ where: { id: enrollment.id, status: "ACTIVE" }, data: { nextSendAt: at } });
    }
  } else if (!paused && action.kind === "finish") {
    const { count } = await prisma.campaignProspect.updateMany({
      where: { id: enrollment.id, status: "ACTIVE" },
      data: { status: "FINISHED", finishedAt: now },
    });
    if (count > 0) await releaseCampaignLink(link.id);
  }

  await prisma.campaignProspect.updateMany({ where: { id: enrollment.id }, data: { readEvaluatedAt: now } });
  return action.kind;
}

/**
 * The tick's catch-up for readings the hooks missed: enrollments whose link saw a human page view after the last
 * evaluation, once the reader has been quiet for a few minutes. Returns how many were evaluated.
 */
export async function evaluateReadingSignals(now: Date, scope: OutreachScope = {}): Promise<number> {
  const quietSince = new Date(now.getTime() - SETTLE_MS);
  // The comparison runs between two tables' columns, which the query builder cannot express
  const due = await prisma.$queryRaw<{ id: string }[]>`
    SELECT cp."id"
    FROM "campaign_prospects" cp
    JOIN "links" l ON l."id" = cp."linkId"
    WHERE cp."status" IN ('ACTIVE', 'PAUSED')
      AND l."lastActivityAt" IS NOT NULL
      AND l."lastActivityAt" <= ${quietSince}
      AND (
        cp."readEvaluatedAt" IS NULL
        OR EXISTS (
          SELECT 1 FROM "page_views" pv
          JOIN "document_views" dv ON dv."id" = pv."viewId"
          WHERE pv."linkId" = l."id" AND dv."isBot" = false AND pv."lastSeenAt" > cp."readEvaluatedAt"
        )
      )
    ORDER BY cp."readEvaluatedAt" ASC NULLS FIRST
    LIMIT ${TICK_BATCH * 3}`;
  if (due.length === 0) return 0;

  const rows = await prisma.campaignProspect.findMany({
    where: {
      id: { in: due.map((row) => row.id) },
      ...organizationWhere(scope),
      campaign: { status: "ACTIVE", organization: { suspendedAt: null } },
      linkId: { not: null },
    },
    select: { linkId: true },
    take: TICK_BATCH,
  });
  let evaluated = 0;
  for (const row of rows) {
    if (!row.linkId) continue;
    try {
      await evaluateEnrollmentReading(row.linkId, now);
      evaluated++;
    } catch (error) {
      // One enrollment must not keep the others from being read
      console.error(`[outreach-reading] ${row.linkId}`, error);
    }
  }
  return evaluated;
}
