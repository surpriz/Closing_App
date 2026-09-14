import { prisma } from "@/lib/db";

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
      document: {
        select: {
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

  const [totals, visitors, pricing] = await Promise.all([
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
    completionRatio: link.document.numPages
      ? (totals._max.maxPageReached ?? 0) / link.document.numPages
      : 0,
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
