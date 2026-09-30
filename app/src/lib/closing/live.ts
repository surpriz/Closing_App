import { prisma } from "@/lib/db";

import { LIVE_READING_WINDOW_MS } from "./constants";
import { isReadingNow } from "./tracking/live-status";

export type LiveReader = {
  viewId: string;
  name: string | null;
  currentPage: number | null;
  deviceType: string | null;
  startedAt: string;
};

export type LinkLiveState = {
  readers: LiveReader[];
  /** Changes whenever something shown on the link page changed. */
  stamp: string;
};

export async function getLinkLiveState(linkId: string, now = new Date()): Promise<LinkLiveState> {
  const since = new Date(now.getTime() - LIVE_READING_WINDOW_MS);
  const [recent, views, score, followup, alert, action] = await Promise.all([
    prisma.documentView.findMany({
      where: { linkId, isBot: false, lastSeenAt: { gte: since }, leftAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        visitorId: true,
        email: true,
        lastSeenAt: true,
        leftAt: true,
        startedAt: true,
        currentPage: true,
        deviceType: true,
        prospect: { select: { name: true, email: true } },
      },
    }),
    prisma.documentView.aggregate({
      where: { linkId, isBot: false },
      _count: { _all: true },
      _max: { lastSeenAt: true },
    }),
    prisma.engagementScore.findUnique({ where: { linkId }, select: { computedAt: true } }),
    prisma.followup.aggregate({ where: { linkId }, _max: { updatedAt: true } }),
    prisma.sellerAlert.aggregate({ where: { linkId }, _max: { createdAt: true } }),
    prisma.prospectAction.aggregate({ where: { linkId }, _max: { createdAt: true } }),
  ]);

  // One line per browser, even if it has several views open
  const seen = new Set<string>();
  const readers: LiveReader[] = [];
  for (const view of recent) {
    if (!isReadingNow(view, now) || seen.has(view.visitorId)) continue;
    seen.add(view.visitorId);
    readers.push({
      viewId: view.id,
      name: view.prospect?.name ?? view.prospect?.email ?? view.email,
      currentPage: view.currentPage,
      deviceType: view.deviceType,
      startedAt: view.startedAt.toISOString(),
    });
  }

  const stamp = [
    readers.map((r) => r.viewId).join(","),
    views._count._all,
    views._max.lastSeenAt?.getTime(),
    score?.computedAt.getTime(),
    followup._max.updatedAt?.getTime(),
    alert._max.createdAt?.getTime(),
    action._max.createdAt?.getTime(),
  ].join(":");

  return { readers, stamp };
}
