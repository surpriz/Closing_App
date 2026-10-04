import { prisma } from "@/lib/db";

import { DAY_MS } from "../constants";
import { hasReason } from "../engagement/reasons";
import type { FeedSource } from "./feed";
import type { FunnelLinkFacts } from "./funnel";
import { firstProspect, linkLabelSelect, prospectLabel } from "./labels";

/**
 * Every read of the "Aujourd'hui" page. Scoped to the workspace, bots left
 * out. Turning rows into figures and sentences is left to the pure modules
 * next to this file.
 */

const OPEN_FOLLOWUP_STATUSES = ["PENDING", "GENERATED", "SCHEDULED"] as const;
const FEED_TAKE = 15;
/** Open deals loaded for the temperature bar and the "À traiter" list. */
const DEALS_TAKE = 200;
/** Cohort size the funnel is computed on; beyond that it undercounts. */
const COHORT_TAKE = 2000;

/** Deals still in play, with what the "À traiter" list and the temperature bar need. */
export async function getOpenDeals(organizationId: string) {
  const deals = await prisma.link.findMany({
    where: { organizationId, archivedAt: null, dealStatus: { in: ["OPEN", "CHANGE_REQUESTED"] } },
    orderBy: { createdAt: "desc" },
    take: DEALS_TAKE,
    select: {
      id: true,
      name: true,
      slug: true,
      dealStatus: true,
      sentAt: true,
      createdAt: true,
      lastActivityAt: true,
      followupsEnabled: true,
      engagementScore: { select: { score: true, tier: true, reasons: true } },
      document: { select: { name: true } },
      prospects: firstProspect,
      followups: {
        where: { status: { in: [...OPEN_FOLLOWUP_STATUSES] } },
        orderBy: { scheduledFor: "asc" },
        take: 1,
        select: { scheduledFor: true, channel: true, timezone: true },
      },
      views: { where: { isBot: false }, orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
    },
  });

  return deals.map(({ views: [lastView], ...deal }) => ({
    ...deal,
    dealStatus: deal.dealStatus as "OPEN" | "CHANGE_REQUESTED",
    opened: lastView !== undefined,
    // Only flushes with reading time set lastActivityAt: a prospect who
    // closed the tab right away still opened the link.
    lastActivityAt: deal.lastActivityAt ?? lastView?.lastSeenAt ?? null,
    pricingFocus: hasReason(deal.engagementScore?.reasons, "pricing_focus"),
  }));
}

export type OpenDeal = Awaited<ReturnType<typeof getOpenDeals>>[number];

/** Links sent since `since` (all links when null), and how far each one went. */
export async function getFunnelFacts(organizationId: string, since: Date | null): Promise<FunnelLinkFacts[]> {
  const links = await prisma.link.findMany({
    where: {
      organizationId,
      archivedAt: null,
      ...(since && { OR: [{ sentAt: { gte: since } }, { sentAt: null, createdAt: { gte: since } }] }),
    },
    orderBy: { createdAt: "desc" },
    take: COHORT_TAKE,
    select: {
      id: true,
      dealStatus: true,
      document: { select: { numPages: true } },
      engagementScore: { select: { reasons: true } },
      actions: { where: { type: "VALIDATE_SIGN" }, take: 1, select: { id: true } },
    },
  });
  if (links.length === 0) return [];

  const reading = await prisma.documentView.groupBy({
    by: ["linkId"],
    where: { isBot: false, linkId: { in: links.map((link) => link.id) } },
    _count: { _all: true },
    _sum: { totalDurationMs: true },
    _max: { maxPageReached: true },
  });
  const byLink = new Map(reading.map((row) => [row.linkId, row]));

  return links.map((link) => {
    const row = byLink.get(link.id);
    return {
      numPages: link.document.numPages,
      viewCount: row?._count._all ?? 0,
      maxPageReached: row?._max.maxPageReached ?? 0,
      totalDurationMs: row?._sum.totalDurationMs ?? 0,
      pricingFocus: hasReason(link.engagementScore?.reasons, "pricing_focus"),
      validated: link.dealStatus === "VALIDATED" || link.dealStatus === "WON" || link.actions.length > 0,
    };
  });
}

export async function getFeedSource(organizationId: string, since: Date | null): Promise<FeedSource> {
  const ofWorkspace = { link: { organizationId, archivedAt: null } };
  const linkWithDocument = { select: { ...linkLabelSelect, document: { select: { name: true } } } } as const;

  const [views, actions, alerts, followups] = await Promise.all([
    prisma.documentView.findMany({
      where: { ...ofWorkspace, isBot: false, ...(since && { lastSeenAt: { gte: since } }) },
      orderBy: { lastSeenAt: "desc" },
      take: FEED_TAKE,
      select: {
        id: true,
        documentId: true,
        lastSeenAt: true,
        totalDurationMs: true,
        email: true,
        prospect: { select: { name: true, email: true } },
        link: linkWithDocument,
      },
    }),
    prisma.prospectAction.findMany({
      where: { ...ofWorkspace, ...(since && { createdAt: { gte: since } }) },
      orderBy: { createdAt: "desc" },
      take: FEED_TAKE,
      select: {
        id: true,
        createdAt: true,
        type: true,
        message: true,
        prospect: { select: { name: true, email: true, company: true } },
        link: linkWithDocument,
      },
    }),
    prisma.sellerAlert.findMany({
      where: { ...ofWorkspace, ...(since && { createdAt: { gte: since } }) },
      orderBy: { createdAt: "desc" },
      take: FEED_TAKE,
      select: { id: true, createdAt: true, type: true, payload: true, link: { select: linkLabelSelect } },
    }),
    prisma.followup.findMany({
      where: {
        ...ofWorkspace,
        status: { in: ["SENT", "DELIVERED"] },
        sentAt: since ? { gte: since } : { not: null },
      },
      orderBy: { sentAt: "desc" },
      take: FEED_TAKE,
      select: {
        id: true,
        sentAt: true,
        channel: true,
        trigger: true,
        prospect: { select: { name: true, email: true, company: true } },
        link: { select: linkLabelSelect },
      },
    }),
  ]);

  const pricingByView = await getPricingTimeByView(views);

  return {
    views: views.map((view) => ({
      id: view.id,
      lastSeenAt: view.lastSeenAt,
      linkId: view.link.id,
      linkLabel: prospectLabel(view.link),
      reader: view.prospect?.name ?? view.prospect?.email ?? view.email,
      documentName: view.link.document.name,
      totalDurationMs: view.totalDurationMs,
      pricingDurationMs: pricingByView.get(view.id) ?? 0,
    })),
    actions: actions.map((action) => ({
      id: action.id,
      createdAt: action.createdAt,
      linkId: action.link.id,
      who: action.prospect?.company ?? action.prospect?.name ?? prospectLabel(action.link),
      type: action.type,
      documentName: action.link.document.name,
      message: action.message,
    })),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      createdAt: alert.createdAt,
      linkId: alert.link.id,
      linkLabel: prospectLabel(alert.link),
      type: alert.type,
      payload: alert.payload,
    })),
    followups: followups.map((followup) => ({
      id: followup.id,
      sentAt: followup.sentAt!,
      linkId: followup.link.id,
      who: followup.prospect.company ?? followup.prospect.name ?? prospectLabel(followup.link),
      channel: followup.channel,
      trigger: followup.trigger,
    })),
  };
}

/** Time spent on pricing pages, per reading session. */
async function getPricingTimeByView(views: { id: string; documentId: string }[]) {
  const result = new Map<string, number>();
  if (views.length === 0) return result;

  const pricingPages = await prisma.documentPage.findMany({
    where: { documentId: { in: [...new Set(views.map((view) => view.documentId))] }, tags: { has: "PRICING" } },
    select: { documentId: true, pageNumber: true },
  });
  if (pricingPages.length === 0) return result;

  const isPricing = new Set(pricingPages.map((page) => `${page.documentId}:${page.pageNumber}`));
  const documentOf = new Map(views.map((view) => [view.id, view.documentId]));
  const pages = await prisma.pageView.findMany({
    where: { viewId: { in: views.map((view) => view.id) } },
    select: { viewId: true, pageNumber: true, totalDurationMs: true },
  });
  for (const page of pages) {
    if (!isPricing.has(`${documentOf.get(page.viewId)}:${page.pageNumber}`)) continue;
    result.set(page.viewId, (result.get(page.viewId) ?? 0) + page.totalDurationMs);
  }
  return result;
}

export function getUpcomingFollowups(organizationId: string) {
  return prisma.followup.findMany({
    where: { link: { organizationId, archivedAt: null }, status: { in: ["GENERATED", "SCHEDULED"] } },
    orderBy: { scheduledFor: "asc" },
    take: 4,
    select: {
      id: true,
      scheduledFor: true,
      timezone: true,
      channel: true,
      link: { select: { id: true } },
      prospect: { select: { name: true, email: true, company: true } },
    },
  });
}

/** Validations of the last 24 hours, for the headline, whatever the period. */
export async function getFreshValidations(organizationId: string, now: Date) {
  const actions = await prisma.prospectAction.findMany({
    where: {
      link: { organizationId },
      type: "VALIDATE_SIGN",
      createdAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      prospect: { select: { company: true } },
      link: { select: { name: true, slug: true, prospects: firstProspect } },
    },
  });
  return actions.map((action) => action.prospect?.company ?? prospectLabel(action.link));
}
