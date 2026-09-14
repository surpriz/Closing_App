import { prisma } from "@/lib/db";

export async function getDocumentAnalytics(documentId: string) {
  const viewWhere = { documentId, isBot: false };

  const [totals, visitors, pages, locations, recentViews] = await Promise.all([
    prisma.documentView.aggregate({
      where: viewWhere,
      _count: { _all: true },
      _sum: { totalDurationMs: true },
      _max: { lastSeenAt: true },
    }),
    prisma.documentView.groupBy({ by: ["visitorId"], where: viewWhere }),
    prisma.pageView.groupBy({
      by: ["pageNumber"],
      where: { view: viewWhere },
      _sum: { totalDurationMs: true },
      _count: { _all: true },
    }),
    prisma.documentView.groupBy({
      by: ["country", "city", "timezone"],
      where: viewWhere,
      _count: { _all: true },
    }),
    prisma.documentView.findMany({
      where: viewWhere,
      orderBy: { lastSeenAt: "desc" },
      take: 15,
      include: {
        link: { select: { name: true, slug: true } },
        prospect: { select: { name: true, email: true, company: true } },
      },
    }),
  ]);

  return {
    viewCount: totals._count._all,
    uniqueVisitors: visitors.length,
    totalDurationMs: totals._sum.totalDurationMs ?? 0,
    lastActivityAt: totals._max.lastSeenAt,
    pages: pages
      .map((p) => ({
        pageNumber: p.pageNumber,
        totalDurationMs: p._sum.totalDurationMs ?? 0,
        viewCount: p._count._all,
      }))
      .sort((a, b) => a.pageNumber - b.pageNumber),
    locations: locations
      .map((l) => ({
        country: l.country,
        city: l.city,
        timezone: l.timezone,
        viewCount: l._count._all,
      }))
      .sort((a, b) => b.viewCount - a.viewCount),
    recentViews,
  };
}
