import { DEFAULT_UI_LOCALE } from "@/i18n/locale";
import { prisma } from "@/lib/db";
import { isCampaignOwned } from "@/lib/outreach/ownership";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { generateFollowupMessage, queueFollowup } from "../followups/queue";
import { defaultTimezone, getWorkspaceSettings, resolveFollowupSettings } from "../settings";
import { toStoredInsight } from "./latest";
import { habitualSendHour } from "../scheduling/send-time";
import { decideFollowup } from "./policy";
import type { Insight } from "./schema";

/** Follow-ups the AI wrote and the seller hasn't approved: replaced by a newer analysis. */
const UNAPPROVED = ["PENDING", "DRAFT"] as const;

export type ActResult = { ok: true; followupId: string } | { ok: false; reasons: string[] };

/**
 * Turns an analysis into a follow-up draft when it recommends one and the
 * policy allows it. `force` is the seller asking for a message whatever the
 * analysis recommended; the policy still applies.
 */
export async function actOnInsight(insightId: string, { force = false, now = new Date() } = {}): Promise<ActResult> {
  const row = await prisma.dealInsight.findUnique({
    where: { id: insightId },
    include: { link: { select: { createdBy: { select: { locale: true } } } } },
  });
  if (!row) return { ok: false, reasons: [getNamespaceTranslator(DEFAULT_UI_LOCALE, "server.followups.act")("insightNotFound")] };
  // Reasons go back to the seller who sent the link
  const locale = toUiLocale(row.link.createdBy?.locale);
  const t = getNamespaceTranslator(locale, "server.followups.act");
  const insight = toStoredInsight(row);
  const action = insight.recommendedAction;

  if (!force && action.type !== "send_followup") return { ok: false, reasons: [t("notRecommended")] };

  const link = await prisma.link.findUnique({
    where: { id: row.linkId },
    include: {
      prospects: { orderBy: { createdAt: "asc" } },
      followups: {
        where: {
          OR: [
            { status: { in: ["SENT", "DELIVERED"] } },
            { status: { in: ["GENERATED", "SCHEDULED"] } },
            { trigger: "EXPIRY_REMINDER", status: { in: ["PENDING", "DRAFT"] } },
          ],
        },
        select: { prospectId: true, status: true, sentAt: true, trigger: true },
      },
      sellerActivities: {
        where: { type: { in: ["CALL", "EMAIL_REPLY_RECEIVED", "MEETING", "MANUAL_SEND"] } },
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true },
      },
    },
  });
  if (!link) return { ok: false, reasons: [t("linkNotFound")] };

  const workspace = await getWorkspaceSettings(link.organizationId);
  const resolved = resolveFollowupSettings(link, workspace);
  const prospect =
    link.prospects.find((p) => p.id === action.prospectId) ?? (force ? link.prospects[0] : undefined) ?? null;
  const timezone = prospect?.timezone ?? defaultTimezone();

  const businessHours = {
    startHour: resolved.businessHourStart,
    endHour: resolved.businessHourEnd,
    days: resolved.businessDays,
  };
  const decision = decideFollowup({
    now,
    locale,
    timing: force && action.type !== "send_followup" ? "now" : action.timing,
    channel: action.channel,
    deal: {
      dealStatus: link.dealStatus,
      followupsEnabled: link.followupsEnabled,
      archived: link.archivedAt !== null,
      snoozedUntil: link.snoozedUntil,
      meetingBooked: link.meetingBookedAt !== null,
      quoteRequested: link.quoteRequestedAt !== null,
      // A follow-up the seller asks for is theirs to send
      replied: !force && link.repliedAt !== null,
      campaignOwned: isCampaignOwned(link),
      decisionDeadline: link.decisionDeadline,
      expiresAt: link.expiresAt,
      channels: resolved.channels,
      lastReadingAt: link.lastActivityAt,
    },
    prospect: prospect
      ? {
          unsubscribed: prospect.unsubscribedAt !== null,
          bounced: prospect.bouncedAt !== null,
          canWhatsApp: !!prospect.phoneE164 && !!prospect.whatsappOptInAt,
          timezone,
        }
      : null,
    history: {
      sentAt: link.followups
        .filter((f) => f.prospectId === prospect?.id && f.sentAt)
        .map((f) => f.sentAt!),
      lastSellerContactAt: force ? null : (link.sellerActivities[0]?.occurredAt ?? null),
      approvedPending: link.followups.some((f) => f.status === "GENERATED" || f.status === "SCHEDULED"),
      expiryReminderOpen: link.followups.some((f) => f.trigger === "EXPIRY_REMINDER" && !f.sentAt),
    },
    settings: {
      maxFollowupsPer30Days: workspace.maxFollowupsPer30Days,
      minDaysBetweenFollowups: workspace.minDaysBetweenFollowups,
      minDelayAfterReadingHours: workspace.minDelayAfterReadingHours,
      businessHours,
      sendHour: await habitualSendHour({
        prospectId: prospect?.id ?? null,
        organizationId: link.organizationId,
        timeZone: timezone,
        hours: businessHours,
        now,
      }),
      seed: `ai:${insightId}`,
    },
  });
  if (!decision.allowed || !prospect) return { ok: false, reasons: decision.allowed ? [] : decision.reasons };

  const brief: Insight["followupBrief"] = insight.followupBrief ?? {
    goal: "gentle_reminder",
    angle: action.why,
    topics: [],
    avoid: [],
  };
  const followupId = await queueFollowup({
    linkId: link.id,
    prospectId: prospect.id,
    trigger: "AI_DECISION",
    channel: decision.channel,
    scheduledFor: decision.scheduledFor,
    timezone,
    // Unknown prospect language: the seller's, not French by default
    locale: prospect.locale ?? locale,
    dedupeKey: `ai:${link.id}:${insightId}:${force ? "seller" : "auto"}`,
    context: { insightId, brief },
  });
  if (!followupId) return { ok: false, reasons: [t("alreadyExists")] };

  // One AI follow-up in flight per deal: the newest reading replaces the older draft (a cold email one too).
  // Only once the new one exists: a reading already acted on must not leave the deal with none
  await prisma.followup.updateMany({
    where: {
      linkId: link.id,
      trigger: { in: ["AI_DECISION", "WARM_READ"] },
      status: { in: [...UNAPPROVED] },
      id: { not: followupId },
    },
    data: { status: "CANCELLED", cancelledAt: now, error: t("replaced") },
  });

  await prisma.followup.update({
    where: { id: followupId },
    data: {
      insightId,
      confidence: insight.confidence,
      rationale: force && action.type !== "send_followup" ? t("preparedOnRequest", { headline: insight.headline }) : action.why,
    },
  });
  await generateFollowupMessage(followupId);
  return { ok: true, followupId };
}
