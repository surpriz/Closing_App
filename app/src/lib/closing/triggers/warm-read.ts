import { prisma } from "@/lib/db";

import { WARM_READ_MIN_MS } from "../constants";
import { isLinkExpired } from "../expiry";
import { generateFollowupMessage, OPEN_FOLLOWUP_STATUSES, queueFollowup } from "../followups/queue";
import { habitualSendHour, nextSendSlot } from "../scheduling/send-time";
import { defaultTimezone, getWorkspaceSettings, resolveFollowupSettings } from "../settings";
import { readingOfLink } from "../shared/reading-time";

/**
 * A Smart Link reader read for a while and did not answer: instead of the
 * cold email tool's generic step 3, a follow-up on the topic they read the
 * longest, next business morning. The writer never says how they read it.
 * Once per reader and channel, and never on top of another open follow-up.
 */
export async function evaluateWarmRead(viewId: string, now = new Date()) {
  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: {
      isBot: true,
      timezone: true,
      locale: true,
      prospect: true,
      link: {
        select: {
          id: true,
          parentLinkId: true,
          organizationId: true,
          documentId: true,
          followupsEnabled: true,
          dealStatus: true,
          archivedAt: true,
          meetingBookedAt: true,
          repliedAt: true,
          quoteRequestedAt: true,
          snoozedUntil: true,
          expiresAt: true,
          channels: true,
          hotPricingThresholdSec: true,
          inactivityDays: true,
          businessHourStart: true,
          businessHourEnd: true,
        },
      },
    },
  });
  if (!view || view.isBot) return;

  const { link, prospect } = view;
  if (!link.parentLinkId || prospect?.origin !== "COLD_EMAIL" || prospect.unsubscribedAt || prospect.bouncedAt) return;
  if (!link.followupsEnabled || link.dealStatus !== "OPEN" || link.archivedAt || link.meetingBookedAt || link.quoteRequestedAt || link.repliedAt) return;
  if (link.snoozedUntil && link.snoozedUntil > now) return;
  if (isLinkExpired(link, now)) return;

  // Already written once, or another follow-up in flight: most flushes stop here
  const existing = await prisma.followup.findFirst({
    where: {
      linkId: link.id,
      OR: [{ trigger: "WARM_READ" }, { status: { in: [...OPEN_FOLLOWUP_STATUSES] } }],
    },
    select: { id: true },
  });
  if (existing) return;

  const reading = await readingOfLink(link.id, link.documentId);
  if (reading.readingMs < WARM_READ_MIN_MS) return;

  const settings = resolveFollowupSettings(link, await getWorkspaceSettings(link.organizationId));
  const timezone = prospect.timezone ?? view.timezone ?? defaultTimezone();
  const locale = prospect.locale ?? view.locale ?? "en";
  const hours = { startHour: settings.businessHourStart, endHour: settings.businessHourEnd, days: settings.businessDays };
  const sendHour = await habitualSendHour({ prospectId: prospect.id, organizationId: link.organizationId, timeZone: timezone, hours, now });
  const scheduledFor = nextSendSlot(now, timezone, hours, "next-morning", sendHour, `warm_read:${prospect.id}`);

  for (const channel of settings.channels) {
    if (channel === "WHATSAPP" && (!prospect.phoneE164 || !prospect.whatsappOptInAt)) continue;

    const followupId = await queueFollowup({
      linkId: link.id,
      prospectId: prospect.id,
      trigger: "WARM_READ",
      channel,
      scheduledFor,
      timezone,
      locale,
      dedupeKey: `warm_read:${prospect.id}:${channel}`,
      context: { viewId, readTags: reading.tags },
    });
    if (followupId) await generateFollowupMessage(followupId);
  }
}
