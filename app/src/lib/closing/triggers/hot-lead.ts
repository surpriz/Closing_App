import { prisma } from "@/lib/db";

import { DAY_MS, LIVE_VIEW_WINDOW_MS } from "../constants";
import { detectCallMoment, type CallMomentFacts } from "../notify/call-moment";
import { notifySeller } from "../notify/notify";
import { getWorkspaceSettings } from "../settings";

/** At most one "call now" alert per link in this window. */
const CALL_MOMENT_WINDOW_MS = 6 * 60 * 60 * 1000;
/** A deal analysis older than this no longer says how hot the deal is. */
const INSIGHT_FRESH_MS = 7 * DAY_MS;

function callMomentKey(linkId: string, now: Date) {
  return `call:${linkId}:${Math.floor(now.getTime() / CALL_MOMENT_WINDOW_MS)}`;
}

async function alreadySignaled(linkId: string, now: Date) {
  const existing = await prisma.sellerAlert.findUnique({
    where: { dedupeKey: callMomentKey(linkId, now) },
    select: { id: true },
  });
  return !!existing;
}

async function signal(linkId: string, viewId: string, facts: CallMomentFacts, now: Date) {
  const moment = detectCallMoment(facts);
  if (!moment) return;
  await notifySeller({
    linkId,
    type: "CALL_MOMENT",
    dedupeKey: callMomentKey(linkId, now),
    payload: {
      reason: moment.detail,
      detail: moment.reason,
      viewId,
      liveViewers: facts.liveReaders,
      inactiveDays: facts.inactiveDays ?? undefined,
    },
    now,
  });
}

/**
 * When a view starts: is this a moment the seller should call? Several people
 * reading, a return after days of silence, the very first opening, or a deal
 * the analysis rates as urgent.
 */
export async function evaluateHotLead(viewId: string, resumed: boolean, now = new Date()) {
  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: { id: true, linkId: true, isBot: true, link: { select: { organizationId: true, dealStatus: true, archivedAt: true } } },
  });
  if (!view || view.isBot || view.link.archivedAt) return;
  if (view.link.dealStatus === "WON" || view.link.dealStatus === "LOST") return;
  if (await alreadySignaled(view.linkId, now)) return;

  const settings = await getWorkspaceSettings(view.link.organizationId);

  const [liveReaders, previousView, insight] = await Promise.all([
    prisma.documentView.groupBy({
      by: ["visitorId"],
      where: {
        linkId: view.linkId,
        isBot: false,
        lastSeenAt: { gte: new Date(now.getTime() - LIVE_VIEW_WINDOW_MS) },
      },
    }),
    resumed
      ? null
      : prisma.documentView.findFirst({
          where: { linkId: view.linkId, isBot: false, id: { not: view.id } },
          orderBy: { lastSeenAt: "desc" },
          select: { lastSeenAt: true },
        }),
    prisma.dealInsight.findFirst({
      where: { linkId: view.linkId, createdAt: { gte: new Date(now.getTime() - INSIGHT_FRESH_MS) } },
      orderBy: { createdAt: "desc" },
      select: { priority: true },
    }),
  ]);

  await signal(
    view.linkId,
    view.id,
    {
      liveReaders: liveReaders.length,
      multiViewerThreshold: settings.multiViewerThreshold,
      committeeThreshold: settings.committeeThreshold,
      firstOpen: !resumed && !previousView,
      inactiveDays: previousView ? Math.floor((now.getTime() - previousView.lastSeenAt.getTime()) / DAY_MS) : null,
      reopenAfterDays: settings.reopenAfterInactivityDays,
      pricingSeconds: null,
      pricingThresholdSec: settings.hotPricingThresholdSec,
      // A resumed session is the same reading: only a sharp change is worth a ping
      aiPriority: resumed ? null : (insight?.priority ?? null),
    },
    now,
  );
}

/**
 * During a reading (each tracking flush): the reader lingers on the pricing
 * pages in this session. Cheap when already signaled, which is most flushes.
 */
export async function evaluatePricingCallMoment(viewId: string, now = new Date()) {
  const view = await prisma.documentView.findUnique({
    where: { id: viewId },
    select: {
      id: true,
      linkId: true,
      isBot: true,
      leftAt: true,
      link: {
        select: {
          organizationId: true,
          dealStatus: true,
          archivedAt: true,
          hotPricingThresholdSec: true,
          document: { select: { pages: { where: { tags: { has: "PRICING" } }, select: { pageNumber: true } } } },
        },
      },
    },
  });
  if (!view || view.isBot || view.leftAt || view.link.archivedAt) return;
  if (view.link.dealStatus !== "OPEN" && view.link.dealStatus !== "CHANGE_REQUESTED") return;
  const pricingPages = view.link.document.pages.map((p) => p.pageNumber);
  if (pricingPages.length === 0) return;
  if (await alreadySignaled(view.linkId, now)) return;

  const settings = await getWorkspaceSettings(view.link.organizationId);
  const threshold = view.link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec;
  const pricing = await prisma.pageView.aggregate({
    where: { viewId: view.id, pageNumber: { in: pricingPages } },
    _sum: { totalDurationMs: true },
  });
  const pricingSeconds = Math.floor((pricing._sum.totalDurationMs ?? 0) / 1000);
  if (pricingSeconds < threshold) return;

  await signal(
    view.linkId,
    view.id,
    {
      liveReaders: 1,
      multiViewerThreshold: settings.multiViewerThreshold,
      committeeThreshold: settings.committeeThreshold,
      firstOpen: false,
      inactiveDays: null,
      reopenAfterDays: settings.reopenAfterInactivityDays,
      pricingSeconds,
      pricingThresholdSec: threshold,
      aiPriority: null,
    },
    now,
  );
}
