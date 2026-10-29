import { Prisma } from "@/generated/prisma/client";
import { DAY_MS } from "@/lib/closing/constants";
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

import { dedupeKeyOf, scheduleStepMessage, STEP_SELECT, type StepRow } from "./messages";
import { outreachOrgIds } from "./flag";
import { releaseCampaignLink } from "./ownership";
import {
  businessHoursOf,
  FINISH_AFTER_LAST_STEP_MS,
  nextStepFor,
  REACTIVATE_AFTER_DAYS,
  // An enrollment paused by a reading signal can still hear about a stronger one; any other pause is left alone
  READING_PAUSES,
  stepSendAt,
  type NextAction,
} from "./planner";
import type { OutreachScope } from "./scope";
import { signalsFrom } from "./signals";

/** A reader still on the page is not evaluated: the tick waits until the reading has settled. */
const SETTLE_MS = 5 * 60 * 1000;
const TICK_BATCH = 100;
const REACTIVATION_BATCH = 50;

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
    include: {
      campaign: {
        select: {
          id: true,
          status: true,
          mailboxId: true,
          organization: { select: { suspendedAt: true } },
          steps: { orderBy: { order: "asc" }, select: STEP_SELECT },
        },
      },
    },
  });
  if (!enrollment || (enrollment.status !== "ACTIVE" && enrollment.status !== "PAUSED")) return null;
  // The hooks call this for any campaign link: out of the beta (kill switch) or suspended, nothing is read, not even
  // stamped, so the reading is still there to evaluate if the workspace comes back
  if (!outreachOrgIds().includes(enrollment.organizationId) || enrollment.campaign.organization.suspendedAt !== null) return null;
  // Stamped even when nothing applies, so the tick does not pick the same enrollment up again and again
  const stamp = () => prisma.campaignProspect.updateMany({ where: { id: enrollment.id }, data: { readEvaluatedAt: now } });
  const paused = enrollment.status === "PAUSED";
  // Not stamped: the tick's catch-up only looks at ACTIVE campaigns and reading pauses, and a reading that happens
  // during a pause is still news once the campaign or the enrollment resumes
  if (enrollment.campaign.status !== "ACTIVE" || (paused && !READING_PAUSES.includes(enrollment.pausedReason ?? ""))) return null;

  const [reading, views, forwards, sent, openFollowups, settings] = await Promise.all([
    readingOfLink(link.id, link.documentId),
    prisma.documentView.findMany({
      where: { linkId: link.id, isBot: false },
      select: { startedAt: true, lastSeenAt: true, isBot: true, totalDurationMs: true, maxPageReached: true },
    }),
    prisma.linkForward.findMany({
      where: { linkId: link.id },
      select: { createdAt: true, toProspect: { select: { email: true } } },
    }),
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
    forwards: forwards.map((forward) => ({ toEmail: forward.toProspect.email, createdAt: forward.createdAt })),
    since: enrollment.readEvaluatedAt,
    enrollment,
    sent: sentMessages,
    openFollowup: openFollowups > 0,
    now,
  });
  const lastSentAt = signals.lastSentAt;

  // A paused enrollment is planned as an active one, but only the signal rows (alert, note) are applied to it
  const plan = (from: typeof signals) =>
    nextStepFor({
      enrollment: { status: "ACTIVE", currentStep: enrollment.currentStep, lastSentAt },
      steps: enrollment.campaign.steps,
      signals: from,
      settings: {
        minDelayAfterReadingHours: settings.minDelayAfterReadingHours,
        maxFollowupsPer30Days: settings.maxFollowupsPer30Days,
        minDaysBetweenFollowups: settings.minDaysBetweenFollowups,
        hotPricingThresholdSec: settings.hotPricingThresholdSec,
      },
      now,
    });
  let action = plan(signals);
  // A forward only has the stamp as side effect, and nothing re-evaluates this session: its read signal applies now
  if (action.kind === "note_forward") action = plan({ ...signals, forwardedTo: [] });
  const hours = businessHoursOf(settings);

  const prospect = await prisma.prospect.findFirst({
    where: enrollment.prospectId ? { id: enrollment.prospectId } : { linkId: link.id, origin: "CAMPAIGN" },
    select: { id: true, timezone: true },
  });
  const timezone = prospect?.timezone ?? enrollment.timezone;

  const queueRead = async (trigger: Trigger, mode: "asap" | "next-morning", key: string): Promise<boolean> => {
    if (!prospect) return false;
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
    if (!followupId) return false;
    await generateFollowupMessage(followupId);
    return true;
  };

  if (action.kind === "pause_alert") {
    const lastSignal = action.reason === "call_moment" ? "pricing" : "deep";
    // The transition is written first: whatever happens to the effects below, this signal is recorded and does not
    // fire again. At the 30-day cap there is no follow-up to end a pause, so the enrollment only records the signal and
    // keeps going; the seller still gets the alert. Same without a prospect row to queue the follow-up for.
    const followup = prospect ? action.followup : null;
    if (!followup) {
      await prisma.campaignProspect.updateMany({ where: { id: enrollment.id, status: enrollment.status }, data: { lastSignal } });
    } else if (paused) {
      await prisma.campaignProspect.updateMany({
        where: { id: enrollment.id, status: "PAUSED" },
        data: { lastSignal, pausedReason: action.reason },
      });
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
    // One AI follow-up at a time: a pricing read only replaces the "deep read" one that is still open. Both effects
    // deduplicated means this reading was already acted on: the pause stays, it matches the alert already sent.
    if (followup) {
      let upgrade = followup === "COLD_READ_PRICING" && enrollment.lastSignal === "deep";
      if (upgrade && signals.openFollowup) {
        // The open one may already be the pricing follow-up (its dedupe key would refuse a second): then it stays
        const open = await prisma.followup.findMany({
          where: { campaignProspectId: enrollment.id, status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
          select: { trigger: true },
        });
        upgrade = !open.some((row) => row.trigger === "COLD_READ_PRICING");
      }
      if (!signals.openFollowup) {
        await queueRead(followup, "next-morning", lastSignal);
      } else if (upgrade) {
        const replaced = getNamespaceTranslator(toUiLocale(link.createdBy?.locale), "server.followups.act")("replaced");
        await prisma.followup.updateMany({
          where: { campaignProspectId: enrollment.id, status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
          data: { status: "CANCELLED", cancelledAt: now, error: replaced },
        });
        await queueRead(followup, "next-morning", lastSignal);
      }
    }
  } else if (!paused && action.kind === "ai_followup" && !signals.openFollowup) {
    // One AI follow-up at a time: a reactivation waits for the open one to be sent or dropped
    await queueRead(action.trigger, "asap", "reactivate");
    // reactivatedAt records it; lastSignal keeps the last reading signal, so a past deep read does not fire again
    await prisma.campaignProspect.updateMany({
      where: { id: enrollment.id, status: "ACTIVE" },
      data: { reactivatedAt: now },
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

  await stamp();
  return action.kind;
}

/** The scope as SQL on the enrollment alias `cp` (the query builder cannot express the cross-table comparisons below). */
function scopeSql(scope: OutreachScope) {
  const { organizationId, organizationIds } = scope;
  if (organizationIds) {
    const allowed = organizationId ? organizationIds.filter((id) => id === organizationId) : organizationIds;
    return allowed.length > 0 ? Prisma.sql`AND cp."organizationId" IN (${Prisma.join(allowed)})` : Prisma.sql`AND FALSE`;
  }
  return organizationId ? Prisma.sql`AND cp."organizationId" = ${organizationId}` : Prisma.empty;
}

/**
 * The tick's catch-up. First the readings the hooks missed: a human page view after the last evaluation, once the
 * reader has been quiet for a few minutes. Then the time-based pass: a sequence with no step left whose reader went
 * quiet for REACTIVATE_AFTER_DAYS (no view arrives to trigger that one). Returns how many were evaluated.
 */
export async function evaluateReadingSignals(now: Date, scope: OutreachScope = {}): Promise<number> {
  const quietSince = new Date(now.getTime() - SETTLE_MS);
  const scoped = scopeSql(scope);
  const live = Prisma.sql`
    JOIN "links" l ON l."id" = cp."linkId"
    JOIN "campaigns" c ON c."id" = cp."campaignId" AND c."status" = 'ACTIVE'
    JOIN "organizations" o ON o."id" = cp."organizationId" AND o."suspendedAt" IS NULL`;
  const reading = await prisma.$queryRaw<{ linkId: string }[]>`
    SELECT cp."linkId"
    FROM "campaign_prospects" cp ${live}
    WHERE (cp."status" = 'ACTIVE' OR (cp."status" = 'PAUSED' AND cp."pausedReason" IN ('call_moment', 'deep_read')))
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
      ${scoped}
    ORDER BY cp."readEvaluatedAt" ASC NULLS FIRST
    LIMIT ${TICK_BATCH}`;

  // Past the deadline the second pass is not even looked up: the reading pass is the one that cannot wait
  if (pastDeadline(scope)) return evaluateLinks(reading, now, scope);
  const reactivation = await prisma.$queryRaw<{ linkId: string }[]>`
    SELECT cp."linkId"
    FROM "campaign_prospects" cp ${live}
    WHERE cp."status" = 'ACTIVE'
      AND cp."currentStep" >= (SELECT COUNT(*) FROM "campaign_steps" s WHERE s."campaignId" = cp."campaignId")
      AND (cp."readEvaluatedAt" IS NULL OR cp."readEvaluatedAt" < ${new Date(now.getTime() - DAY_MS)})
      AND (
        -- a reader gone quiet: reactivation; a reactivated one: its end of sequence
        l."lastActivityAt" < ${new Date(now.getTime() - REACTIVATE_AFTER_DAYS * DAY_MS)}
        OR cp."reactivatedAt" IS NOT NULL
        -- never opened: the sequence ends after the last mail (the catch-up leaves linked enrollments to this pass)
        OR (
          l."lastActivityAt" IS NULL
          AND (SELECT MAX(m."sentAt") FROM "campaign_messages" m WHERE m."enrollmentId" = cp."id" AND m."status" = 'SENT')
            < ${new Date(now.getTime() - FINISH_AFTER_LAST_STEP_MS)}
        )
      )
      ${scoped}
    ORDER BY cp."readEvaluatedAt" ASC NULLS FIRST
    LIMIT ${REACTIVATION_BATCH}`;

  return evaluateLinks([...reading, ...reactivation], now, scope);
}

/** Real clock, like the deadline itself. */
function pastDeadline(scope: OutreachScope) {
  return scope.deadline !== undefined && Date.now() >= scope.deadline.getTime();
}

async function evaluateLinks(rows: { linkId: string }[], now: Date, scope: OutreachScope): Promise<number> {
  let evaluated = 0;
  for (const linkId of new Set(rows.map((row) => row.linkId))) {
    // What is left waits for the next tick
    if (pastDeadline(scope)) break;
    try {
      await evaluateEnrollmentReading(linkId, now);
      evaluated++;
    } catch (error) {
      // One enrollment must not keep the others from being read
      console.error(`[outreach-reading] ${linkId}`, error);
    }
  }
  return evaluated;
}
