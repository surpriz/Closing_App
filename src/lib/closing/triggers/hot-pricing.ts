import { prisma } from "@/lib/db";

import { generateFollowupMessage, queueFollowup } from "../followups/queue";
import { nextBusinessSlot } from "../scheduling/business-hours";
import { defaultTimezone, getWorkspaceSettings, resolveFollowupSettings } from "../settings";

/**
 * "Hot" follow-up: the prospect spent more than the threshold on the pricing
 * page(s) without validating. Queued for the next business morning in the
 * prospect's timezone. At most one per prospect and channel per link.
 */
export async function evaluateHotPricing(viewId: string, now = new Date()) {
  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    include: {
      prospect: true,
      link: {
        include: {
          prospects: { orderBy: { createdAt: "asc" }, take: 1 },
          document: {
            select: {
              pages: { where: { tags: { has: "PRICING" } }, select: { pageNumber: true } },
            },
          },
        },
      },
    },
  });
  if (!view || view.isBot) return;

  const { link } = view;
  if (!link.followupsEnabled || link.dealStatus !== "OPEN" || link.archivedAt) return;

  const pricingPages = link.document.pages.map((p) => p.pageNumber);
  if (pricingPages.length === 0) return;

  const prospect = view.prospect ?? link.prospects[0];
  if (!prospect || prospect.unsubscribedAt) return;

  const settings = resolveFollowupSettings(link, await getWorkspaceSettings(link.organizationId));

  // Cumulative over this reader's visits, so two short sessions still count
  const pricingTime = await prisma.pageView.aggregate({
    where: {
      linkId: link.id,
      pageNumber: { in: pricingPages },
      view: view.prospectId ? { prospectId: view.prospectId } : { visitorId: view.visitorId },
    },
    _sum: { totalDurationMs: true },
  });
  const pricingDurationMs = pricingTime._sum.totalDurationMs ?? 0;
  if (pricingDurationMs < settings.hotPricingThresholdSec * 1000) return;

  const timezone = prospect.timezone ?? view.timezone ?? defaultTimezone();
  const locale = prospect.locale ?? view.locale ?? "en";
  const scheduledFor = nextBusinessSlot(
    now,
    timezone,
    { startHour: settings.businessHourStart, endHour: settings.businessHourEnd, days: settings.businessDays },
    "next-morning",
  );

  for (const channel of settings.channels) {
    if (channel === "WHATSAPP" && (!prospect.phoneE164 || !prospect.whatsappOptInAt)) continue;

    const followupId = await queueFollowup({
      linkId: link.id,
      prospectId: prospect.id,
      trigger: "HOT_PRICING",
      channel,
      scheduledFor,
      timezone,
      locale,
      dedupeKey: `hot_pricing:${prospect.id}:${channel}`,
      context: { viewId, pricingPages, pricingDurationMs },
    });
    if (followupId) await generateFollowupMessage(followupId);
  }
}
