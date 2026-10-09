import { prisma } from "@/lib/db";

import { DAY_MS } from "../constants";
import { getReaderMap } from "../committee/queries";
import { detectCommittee, detectDecisionMaker, detectNewReader, pickReaderAlert, type ReaderAlert } from "../committee/signals";
import { notifySeller } from "../notify/notify";
import { getWorkspaceSettings } from "../settings";

/** Past this many pushed "new reader" alerts in a day the link went viral: keep quiet. */
const MAX_NEW_READER_PUSHES_PER_DAY = 3;

/**
 * When a view starts: did the proposal reach someone new, a decision maker, or
 * a whole committee reading together? Pushes at most one alert and returns
 * true when it did, so the plain call moment stays quiet for this session.
 */
export async function evaluateReaders(viewId: string, now = new Date()) {
  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: { linkId: true, isBot: true, link: { select: { organizationId: true, dealStatus: true, archivedAt: true } } },
  });
  if (!view || view.isBot || view.link.archivedAt) return false;
  if (view.link.dealStatus === "WON" || view.link.dealStatus === "LOST") return false;

  const [settings, map] = await Promise.all([getWorkspaceSettings(view.link.organizationId), getReaderMap(view.linkId, now)]);

  const candidates = [
    detectDecisionMaker(map, view.linkId, viewId),
    detectCommittee(map, view.linkId, settings.committeeThreshold, now),
    detectNewReader(map, view.linkId, viewId),
  ].filter((a): a is ReaderAlert => a !== null);
  if (candidates.length === 0) return false;

  const existing = await prisma.sellerAlert.findMany({
    where: { dedupeKey: { in: candidates.map((a) => a.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const done = new Set(existing.map((a) => a.dedupeKey));
  const { notify, silent } = pickReaderAlert(candidates.filter((a) => !done.has(a.dedupeKey)));
  if (!notify) return false;

  const viral =
    notify.type === "NEW_READER" &&
    (await prisma.sellerAlert.count({
      where: {
        linkId: view.linkId,
        type: "NEW_READER",
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
        NOT: { channels: { isEmpty: true } },
      },
    })) >= MAX_NEW_READER_PUSHES_PER_DAY;

  const send = (alert: ReaderAlert, silent: boolean) =>
    notifySeller({
      linkId: view.linkId,
      type: alert.type,
      dedupeKey: alert.dedupeKey,
      payload: {
        reason: alert.reason,
        viewId,
        readerName: alert.readerName,
        readerOrigin: alert.readerOrigin,
        readerDomain: alert.readerDomain,
        liveViewers: alert.liveViewers,
        decisionMakers: alert.decisionMakers,
      },
      now,
      silent,
    });

  const pushed = await send(notify, viral);
  for (const alert of silent) await send(alert, true);
  return pushed && !viral;
}
