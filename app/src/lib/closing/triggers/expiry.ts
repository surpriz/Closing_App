import { prisma } from "@/lib/db";

import { markDealDirty } from "../brain/analyze-deal";
import { DAY_MS, HOUR_MS } from "../constants";
import {
  COUNTDOWN_DOC_TYPES,
  expiryReminderKey,
  expiryReminderPlan,
  linkExpiringKey,
  REMINDER_DRAFT_LEAD_MS,
  SELLER_ALERT_LEAD_MS,
} from "../expiry";
import { cancelOpenFollowups, generateFollowupMessage, queueFollowup } from "../followups/queue";
import { notifySeller } from "../notify/notify";
import { defaultTimezone, resolveFollowupSettings } from "../settings";

/** The seller's own recipients only: someone who got the link passed on never asked to hear from us. */
const REMINDER_RECIPIENTS = 3;

/**
 * Quotes and proposals about to expire: one reminder per recipient, about two
 * days before, through the usual follow-up flow (draft in copilot, sent alone
 * in autopilot). Email only: the WhatsApp template can't carry the date.
 * Returns the number of reminders queued.
 */
export async function scanExpiryReminders(now = new Date()) {
  const links = await prisma.link.findMany({
    where: {
      followupsEnabled: true,
      dealStatus: "OPEN",
      archivedAt: null,
      draftAt: null,
      sentAt: { not: null },
      expiresAt: { gt: now, lte: new Date(now.getTime() + REMINDER_DRAFT_LEAD_MS) },
      document: { docType: { in: [...COUNTDOWN_DOC_TYPES] } },
      AND: [{ OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] }],
      prospects: { some: { unsubscribedAt: null, origin: "SELLER" } },
    },
    include: {
      prospects: {
        where: { unsubscribedAt: null, origin: "SELLER" },
        orderBy: { createdAt: "asc" },
        take: REMINDER_RECIPIENTS,
      },
      organization: { include: { settings: true } },
      followups: {
        where: { status: { in: ["SENT", "DELIVERED"] }, sentAt: { gte: new Date(now.getTime() - DAY_MS) } },
        select: { prospectId: true },
      },
    },
    take: 200,
  });

  let queued = 0;

  for (const link of links) {
    const workspaceSettings = link.organization.settings;
    if (!workspaceSettings || !link.expiresAt) continue;
    const settings = resolveFollowupSettings(link, workspaceSettings);
    if (!settings.channels.includes("EMAIL")) continue;

    for (const prospect of link.prospects) {
      // Two messages the same day would be one too many: try again on a later tick
      if (link.followups.some((f) => f.prospectId === prospect.id)) continue;

      const timezone = prospect.timezone ?? defaultTimezone();
      const plan = expiryReminderPlan({
        now,
        expiresAt: link.expiresAt,
        sentAt: link.sentAt,
        timezone,
        hours: { startHour: settings.businessHourStart, endHour: settings.businessHourEnd, days: settings.businessDays },
      });
      if (plan.kind !== "queue") continue;

      const followupId = await queueFollowup({
        linkId: link.id,
        prospectId: prospect.id,
        trigger: "EXPIRY_REMINDER",
        channel: "EMAIL",
        scheduledFor: plan.scheduledFor,
        timezone,
        locale: prospect.locale ?? "fr",
        dedupeKey: expiryReminderKey(link.id, link.expiresAt, prospect.id),
        context: {
          expiresAt: link.expiresAt.toISOString(),
          hoursLeft: Math.round((link.expiresAt.getTime() - now.getTime()) / HOUR_MS),
        },
      });
      if (!followupId) continue;

      queued++;
      // The reminder is the next message: an unapproved AI one would make two
      await prisma.followup.updateMany({
        where: { linkId: link.id, prospectId: prospect.id, trigger: "AI_DECISION", status: { in: ["PENDING", "DRAFT"] } },
        data: { status: "CANCELLED", cancelledAt: now, error: "Remplacée par le rappel d'échéance" },
      });
      await generateFollowupMessage(followupId);
    }
  }

  return queued;
}

/**
 * Tells the seller a link expires within a day, whatever the document. In
 * working hours only: outside them nothing is stored, the next tick asks again.
 */
export async function scanExpiringLinks(now = new Date()) {
  const links = await prisma.link.findMany({
    where: {
      archivedAt: null,
      draftAt: null,
      dealStatus: { in: ["OPEN", "CHANGE_REQUESTED"] },
      expiresAt: { gt: now, lte: new Date(now.getTime() + SELLER_ALERT_LEAD_MS) },
    },
    select: { id: true, expiresAt: true },
    take: 200,
  });

  const keyed = links.flatMap(({ id, expiresAt }) => (expiresAt ? [{ id, expiresAt, key: linkExpiringKey(id, expiresAt) }] : []));
  const done = new Set(
    (
      await prisma.sellerAlert.findMany({
        where: { dedupeKey: { in: keyed.map((link) => link.key) } },
        select: { dedupeKey: true },
      })
    ).map((alert) => alert.dedupeKey),
  );

  let alerted = 0;
  for (const link of keyed) {
    if (done.has(link.key)) continue;
    const sent = await notifySeller({
      linkId: link.id,
      type: "LINK_EXPIRING",
      dedupeKey: link.key,
      payload: { expiresAt: link.expiresAt.toISOString() },
      now,
      deferOutsideWorkingHours: true,
    });
    if (sent) alerted++;
  }
  return alerted;
}

/**
 * The seller moved, removed or set the deadline. Reminders written for the old
 * date are dropped (the scans re-arm them: the date is in their dedupe key) and
 * the analysis takes another look.
 */
export async function onLinkExpiryChanged(linkId: string, now = new Date()) {
  await cancelOpenFollowups(linkId, "Échéance modifiée", ["EXPIRY_REMINDER"]);
  await markDealDirty(linkId, now);
}
