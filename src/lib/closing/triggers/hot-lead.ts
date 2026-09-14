import { prisma } from "@/lib/db";

import { createAndDeliverAlert } from "../alerts/send-alert";
import { LIVE_VIEW_WINDOW_MS } from "../constants";
import { getWorkspaceSettings } from "../settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Real-time seller alerts when a view starts:
 * - more live readers than the workspace threshold (the proposal is being shared)
 * - the link is reopened after days without any reading
 */
export async function evaluateHotLead(viewId: string, resumed: boolean, now = new Date()) {
  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: { id: true, linkId: true, isBot: true, link: { select: { organizationId: true } } },
  });
  if (!view || view.isBot) return;

  const settings = await getWorkspaceSettings(view.link.organizationId);

  const liveReaders = await prisma.documentView.groupBy({
    by: ["visitorId"],
    where: {
      linkId: view.linkId,
      isBot: false,
      lastSeenAt: { gte: new Date(now.getTime() - LIVE_VIEW_WINDOW_MS) },
    },
  });
  if (liveReaders.length > settings.multiViewerThreshold) {
    await createAndDeliverAlert({
      linkId: view.linkId,
      type: "MULTI_VIEWER",
      // at most one per link per hour
      dedupeKey: `multi_viewer:${view.linkId}:${now.toISOString().slice(0, 13)}`,
      payload: { liveViewers: liveReaders.length },
    });
  }

  if (resumed) return;

  const previousView = await prisma.documentView.findFirst({
    where: { linkId: view.linkId, isBot: false, id: { not: view.id } },
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true },
  });
  if (!previousView) return;

  const inactiveDays = Math.floor((now.getTime() - previousView.lastSeenAt.getTime()) / DAY_MS);
  if (inactiveDays >= settings.reopenAfterInactivityDays) {
    await createAndDeliverAlert({
      linkId: view.linkId,
      type: "REOPENED_AFTER_INACTIVITY",
      dedupeKey: `reopened:${view.id}`,
      payload: { inactiveDays },
    });
  }
}
