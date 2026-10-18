import { ACTIVE_WORKSPACE } from "@/lib/closing/active-workspace";
import { prisma } from "@/lib/db";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { DAY_MS } from "../constants";
import { notExpired } from "../expiry";
import { generateFollowupMessage, queueFollowup } from "../followups/queue";
import { habitualSendHour, nextSendSlot } from "../scheduling/send-time";
import { defaultTimezone, resolveFollowupSettings } from "../settings";

const replaced = (locale: string | null | undefined) =>
  getNamespaceTranslator(toUiLocale(locale), "server.followups.act")("replacedStep");

/**
 * Links never opened N days after being sent (N from the inactivity steps,
 * e.g. 3, 7 then 14). Only the latest reached step is queued, once per prospect.
 * Returns the number of follow-ups queued.
 */
export async function scanAntiGhosting(now = new Date()) {
  const links = await prisma.link.findMany({
    where: {
      followupsEnabled: true,
      dealStatus: "OPEN",
      archivedAt: null,
      meetingBookedAt: null,
      repliedAt: null,
      quoteRequestedAt: null,
      AND: [{ OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] }, notExpired(now)],
      sentAt: { lte: new Date(now.getTime() - DAY_MS) },
      views: { none: { isBot: false } },
      prospects: { some: { unsubscribedAt: null, bouncedAt: null } },
      ...ACTIVE_WORKSPACE,
    },
    include: {
      prospects: { where: { unsubscribedAt: null, bouncedAt: null } },
      organization: { include: { settings: true } },
      createdBy: { select: { locale: true } },
    },
    take: 200,
  });

  let queued = 0;
  const workspaceHours = new Map<string, number | null>();

  for (const link of links) {
    const workspaceSettings = link.organization.settings;
    if (!workspaceSettings || !link.sentAt) continue;

    const settings = resolveFollowupSettings(link, workspaceSettings);
    const daysSinceSent = Math.floor((now.getTime() - link.sentAt.getTime()) / DAY_MS);
    const reached = settings.inactivityDays.filter((days) => days <= daysSinceSent);
    if (reached.length === 0) continue;
    const step = Math.max(...reached);
    // The last step closes the loop instead of chasing again (only in a sequence of several)
    const final = settings.inactivityDays.length > 1 && step === Math.max(...settings.inactivityDays);

    for (const prospect of link.prospects) {
      const timezone = prospect.timezone ?? defaultTimezone();
      const hours = { startHour: settings.businessHourStart, endHour: settings.businessHourEnd, days: settings.businessDays };

      for (const channel of settings.channels) {
        if (channel === "WHATSAPP" && (!prospect.phoneE164 || !prospect.whatsappOptInAt)) continue;
        const dedupeKey = `anti_ghosting:${step}:${prospect.id}:${channel}`;
        // Every tick sees the same links: only a step not queued yet is worth scheduling
        if (await prisma.followup.findUnique({ where: { dedupeKey }, select: { id: true } })) continue;

        // Never opened: no habit of their own, the workspace's prospects' hour
        const hourKey = `${link.organizationId}:${hours.startHour}-${hours.endHour}`;
        if (!workspaceHours.has(hourKey)) {
          workspaceHours.set(
            hourKey,
            await habitualSendHour({ prospectId: null, organizationId: link.organizationId, timeZone: timezone, hours, now }),
          );
        }
        const scheduledFor = nextSendSlot(now, timezone, hours, "asap", workspaceHours.get(hourKey) ?? null, dedupeKey);

        const followupId = await queueFollowup({
          linkId: link.id,
          prospectId: prospect.id,
          trigger: "ANTI_GHOSTING",
          channel,
          scheduledFor,
          timezone,
          // Unknown prospect language: the seller's, not French by default
          locale: prospect.locale ?? toUiLocale(link.createdBy?.locale),
          dedupeKey,
          context: { step, daysSinceSent, clicked: !!link.gateSeenAt, final },
        });
        if (followupId) {
          queued++;
          // The previous step's message was never approved: this one takes its place
          await prisma.followup.updateMany({
            where: {
              linkId: link.id,
              prospectId: prospect.id,
              trigger: "ANTI_GHOSTING",
              status: { in: ["PENDING", "DRAFT"] },
              id: { not: followupId },
            },
            data: { status: "CANCELLED", cancelledAt: now, error: replaced(link.createdBy?.locale) },
          });
          await generateFollowupMessage(followupId);
        }
      }
    }
  }

  return queued;
}
