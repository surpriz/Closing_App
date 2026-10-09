import { prisma } from "@/lib/db";

import { LIVE_READING_WINDOW_MS } from "./constants";
import { linkLabelSelect, prospectLabel } from "./dashboard/labels";
import { sellerLinks, type SellerScope } from "./dashboard/queries";
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

const readerSelect = {
  id: true,
  visitorId: true,
  email: true,
  lastSeenAt: true,
  leftAt: true,
  startedAt: true,
  currentPage: true,
  deviceType: true,
  prospect: { select: { name: true, email: true } },
} as const;

export async function getLinkLiveState(linkId: string, now = new Date()): Promise<LinkLiveState> {
  const since = new Date(now.getTime() - LIVE_READING_WINDOW_MS);
  const [recent, views, score, followup, alert, action] = await Promise.all([
    prisma.documentView.findMany({
      where: { linkId, isBot: false, lastSeenAt: { gte: since }, leftAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: readerSelect,
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
  const readers = pickReaders(recent, now, (view) => view.visitorId).map(toLiveReader);

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

export type WorkspaceLiveReader = LiveReader & { linkId: string; label: string };

export type WorkspaceLiveState = {
  readers: WorkspaceLiveReader[];
  /** Changes when a session starts or ends, or a follow-up, alert or answer moves. */
  stamp: string;
};

/**
 * Same as getLinkLiveState, across the workspace. The stamp leaves out
 * lastSeenAt, score times and Link.updatedAt on purpose: they move on every
 * 10 s flush, and refreshing the whole dashboard that often is not worth it.
 * Deal changes made by the seller already revalidate the page.
 */
export async function getWorkspaceLiveState(
  organizationId: string,
  now = new Date(),
  /** Only this seller's links: their dashboard and their extension. */
  owner?: SellerScope,
): Promise<WorkspaceLiveState> {
  const since = new Date(now.getTime() - LIVE_READING_WINDOW_MS);
  // A teammate's activity must not refresh this seller's page
  const ofWorkspace = { link: { organizationId, ...(owner && sellerLinks(owner)) } };
  const [recent, sessions, followup, alert, action] = await Promise.all([
    prisma.documentView.findMany({
      where: {
        isBot: false,
        lastSeenAt: { gte: since },
        leftAt: null,
        link: { organizationId, archivedAt: null, ...(owner && sellerLinks(owner)) },
      },
      orderBy: { lastSeenAt: "desc" },
      select: { ...readerSelect, link: { select: linkLabelSelect } },
    }),
    prisma.documentView.aggregate({ where: { ...ofWorkspace, isBot: false }, _max: { startedAt: true } }),
    prisma.followup.aggregate({ where: ofWorkspace, _max: { updatedAt: true } }),
    prisma.sellerAlert.aggregate({ where: ofWorkspace, _max: { createdAt: true } }),
    prisma.prospectAction.aggregate({ where: ofWorkspace, _max: { createdAt: true } }),
  ]);

  // Two people on the same link are two readers; one person on two links too.
  const readers = pickReaders(recent, now, (view) => `${view.link.id}:${view.visitorId}`).map((view) => ({
    ...toLiveReader(view),
    linkId: view.link.id,
    label: prospectLabel(view.link),
  }));

  const stamp = [
    readers.map((r) => r.viewId).join(","),
    sessions._max.startedAt?.getTime(),
    followup._max.updatedAt?.getTime(),
    alert._max.createdAt?.getTime(),
    action._max.createdAt?.getTime(),
  ].join(":");

  return { readers, stamp };
}

type RecentView = {
  id: string;
  visitorId: string;
  email: string | null;
  lastSeenAt: Date;
  leftAt: Date | null;
  startedAt: Date;
  currentPage: number | null;
  deviceType: string | null;
  prospect: { name: string | null; email: string } | null;
};

/** Views still reading, newest first, one per `key`. */
function pickReaders<V extends RecentView>(recent: V[], now: Date, key: (view: V) => string): V[] {
  const seen = new Set<string>();
  return recent.filter((view) => {
    if (!isReadingNow(view, now) || seen.has(key(view))) return false;
    seen.add(key(view));
    return true;
  });
}

function toLiveReader(view: RecentView): LiveReader {
  return {
    viewId: view.id,
    name: view.prospect?.name ?? view.prospect?.email ?? view.email,
    currentPage: view.currentPage,
    deviceType: view.deviceType,
    startedAt: view.startedAt.toISOString(),
  };
}
