import { prisma } from "@/lib/db";

import { generateFollowupMessage, queueFollowup } from "../followups/queue";
import { defaultTimezone, getWorkspaceSettings, resolveFollowupSettings } from "../settings";
import { toStoredInsight } from "./latest";
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
  const row = await prisma.dealInsight.findUnique({ where: { id: insightId } });
  if (!row) return { ok: false, reasons: ["Analyse introuvable."] };
  const insight = toStoredInsight(row);
  const action = insight.recommendedAction;

  if (!force && action.type !== "send_followup") return { ok: false, reasons: ["L'analyse ne conseille pas d'écrire."] };

  const link = await prisma.link.findUnique({
    where: { id: row.linkId },
    include: {
      prospects: { orderBy: { createdAt: "asc" } },
      followups: {
        where: { OR: [{ status: { in: ["SENT", "DELIVERED"] } }, { status: { in: ["GENERATED", "SCHEDULED"] } }] },
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
  if (!link) return { ok: false, reasons: ["Lien introuvable."] };

  const workspace = await getWorkspaceSettings(link.organizationId);
  const resolved = resolveFollowupSettings(link, workspace);
  const prospect =
    link.prospects.find((p) => p.id === action.prospectId) ?? (force ? link.prospects[0] : undefined) ?? null;
  const timezone = prospect?.timezone ?? defaultTimezone();

  const decision = decideFollowup({
    now,
    timing: force && action.type !== "send_followup" ? "now" : action.timing,
    channel: action.channel,
    deal: {
      dealStatus: link.dealStatus,
      followupsEnabled: link.followupsEnabled,
      archived: link.archivedAt !== null,
      snoozedUntil: link.snoozedUntil,
      decisionDeadline: link.decisionDeadline,
      channels: resolved.channels,
      lastReadingAt: link.lastActivityAt,
    },
    prospect: prospect
      ? {
          unsubscribed: prospect.unsubscribedAt !== null,
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
    },
    settings: {
      maxFollowupsPer30Days: workspace.maxFollowupsPer30Days,
      minDaysBetweenFollowups: workspace.minDaysBetweenFollowups,
      minDelayAfterReadingHours: workspace.minDelayAfterReadingHours,
      businessHours: {
        startHour: resolved.businessHourStart,
        endHour: resolved.businessHourEnd,
        days: resolved.businessDays,
      },
    },
  });
  if (!decision.allowed || !prospect) return { ok: false, reasons: decision.allowed ? [] : decision.reasons };

  // One AI follow-up in flight per deal: the newest reading replaces the older draft
  await prisma.followup.updateMany({
    where: { linkId: link.id, trigger: "AI_DECISION", status: { in: [...UNAPPROVED] } },
    data: { status: "CANCELLED", cancelledAt: now, error: "Remplacée par une analyse plus récente" },
  });

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
    locale: prospect.locale ?? "fr",
    dedupeKey: `ai:${link.id}:${insightId}:${force ? "seller" : "auto"}`,
    context: { insightId, brief },
  });
  if (!followupId) return { ok: false, reasons: ["Une relance existe déjà pour cette analyse."] };

  await prisma.followup.update({
    where: { id: followupId },
    data: {
      insightId,
      confidence: insight.confidence,
      rationale: force && action.type !== "send_followup" ? `Préparée à votre demande. ${insight.headline}` : action.why,
    },
  });
  await generateFollowupMessage(followupId);
  return { ok: true, followupId };
}
