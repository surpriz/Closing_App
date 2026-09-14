import { prisma } from "@/lib/db";

import { generateFollowupMessage, queueFollowup } from "../followups/queue";
import { nextBusinessSlot } from "../scheduling/business-hours";
import { defaultTimezone, resolveFollowupSettings } from "../settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Links never opened N days after being sent (N from the inactivity steps,
 * e.g. 3 then 5). Only the latest reached step is queued, once per prospect.
 * Returns the number of follow-ups queued.
 */
export async function scanAntiGhosting(now = new Date()) {
  const links = await prisma.link.findMany({
    where: {
      followupsEnabled: true,
      dealStatus: "OPEN",
      archivedAt: null,
      sentAt: { lte: new Date(now.getTime() - DAY_MS) },
      views: { none: { isBot: false } },
      prospects: { some: { unsubscribedAt: null } },
    },
    include: {
      prospects: { where: { unsubscribedAt: null } },
      organization: { include: { settings: true } },
    },
    take: 200,
  });

  let queued = 0;

  for (const link of links) {
    const workspaceSettings = link.organization.settings;
    if (!workspaceSettings || !link.sentAt) continue;

    const settings = resolveFollowupSettings(link, workspaceSettings);
    const daysSinceSent = Math.floor((now.getTime() - link.sentAt.getTime()) / DAY_MS);
    const reached = settings.inactivityDays.filter((days) => days <= daysSinceSent);
    if (reached.length === 0) continue;
    const step = Math.max(...reached);

    for (const prospect of link.prospects) {
      const timezone = prospect.timezone ?? defaultTimezone();
      const scheduledFor = nextBusinessSlot(
        now,
        timezone,
        { startHour: settings.businessHourStart, endHour: settings.businessHourEnd, days: settings.businessDays },
        "asap",
      );

      for (const channel of settings.channels) {
        if (channel === "WHATSAPP" && (!prospect.phoneE164 || !prospect.whatsappOptInAt)) continue;

        const followupId = await queueFollowup({
          linkId: link.id,
          prospectId: prospect.id,
          trigger: "ANTI_GHOSTING",
          channel,
          scheduledFor,
          timezone,
          locale: prospect.locale ?? "fr",
          dedupeKey: `anti_ghosting:${step}:${prospect.id}:${channel}`,
          context: { step, daysSinceSent },
        });
        if (followupId) {
          queued++;
          await generateFollowupMessage(followupId);
        }
      }
    }
  }

  return queued;
}
