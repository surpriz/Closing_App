import { prisma } from "@/lib/db";

import { videoProvider } from "../documents/web-link";
import { getWorkspaceSettings } from "../settings";
import { computeEngagementScore } from "./scoring";

// Recomputes and stores the Hot/Warm/Cold score of a link
export async function refreshEngagementScore(linkId: string, now = new Date()) {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      dealStatus: true,
      organizationId: true,
      hotPricingThresholdSec: true,
      meetingBookedAt: true,
      quoteRequestedAt: true,
      document: {
        select: {
          kind: true,
          embedUrl: true,
          numPages: true,
          pages: { where: { tags: { has: "PRICING" } }, select: { pageNumber: true } },
        },
      },
    },
  });
  if (!link) return null;

  const settings = await getWorkspaceSettings(link.organizationId);
  const pricingPages = link.document.pages.map((p) => p.pageNumber);
  const viewWhere = { linkId, isBot: false };
  const isVideo = link.document.kind === "URL" && videoProvider(link.document.embedUrl) !== null;

  const [totals, visitors, pricing, meetingClicks, watched, external] = await Promise.all([
    prisma.documentView.aggregate({
      where: viewWhere,
      _count: { _all: true },
      _sum: { totalDurationMs: true },
      _max: { lastSeenAt: true, maxPageReached: true },
    }),
    prisma.documentView.groupBy({ by: ["visitorId"], where: viewWhere }),
    pricingPages.length > 0
      ? prisma.pageView.aggregate({
          where: { linkId, pageNumber: { in: pricingPages }, view: { isBot: false } },
          _sum: { totalDurationMs: true },
        })
      : null,
    prisma.prospectAction.count({ where: { linkId, type: "MEETING_CLICK" } }),
    isVideo
      ? prisma.pageView.aggregate({
          where: { linkId, pageNumber: 1, view: { isBot: false } },
          _max: { maxScrollDepth: true },
        })
      : null,
    prisma.viewSignal.aggregate({ where: { linkId, type: "EXTERNAL_RETURN" }, _sum: { valueMs: true } }),
  ]);

  const result = computeEngagementScore({
    now,
    dealStatus: link.dealStatus,
    lastActivityAt: totals._max.lastSeenAt,
    totalDurationMs: totals._sum.totalDurationMs ?? 0,
    visitCount: totals._count._all,
    uniqueViewers: visitors.length,
    pricingDurationMs: pricing?._sum.totalDurationMs ?? 0,
    pricingThresholdMs: (link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec) * 1000,
    completionRatio: isVideo
      ? (watched?._max.maxScrollDepth ?? 0)
      : link.document.numPages
        ? (totals._max.maxPageReached ?? 0) / link.document.numPages
        : 0,
    isVideo,
    externalMs: external._sum.valueMs ?? 0,
    meetingClicked: meetingClicks > 0,
    meetingBooked: link.meetingBookedAt !== null,
    quoteRequested: link.quoteRequestedAt !== null,
  });

  const data = {
    score: result.score,
    tier: result.tier,
    uniqueViewers: visitors.length,
    visitCount: totals._count._all,
    totalDurationMs: totals._sum.totalDurationMs ?? 0,
    reasons: JSON.parse(JSON.stringify(result.reasons)),
    computedAt: now,
  };

  return prisma.engagementScore.upsert({
    where: { linkId },
    create: { linkId, ...data },
    update: data,
  });
}

const SCORE_MAX_AGE_MS = 5 * 60 * 1000;

// Recency points fade with time while the score is only stored on activity:
// recompute a stored score that is more than a few minutes old
export async function freshEngagementScore<T extends { computedAt: Date }>(
  linkId: string,
  stored: T | null,
  now = new Date(),
) {
  if (!stored || now.getTime() - stored.computedAt.getTime() <= SCORE_MAX_AGE_MS) return stored;
  return refreshEngagementScore(linkId, now);
}
