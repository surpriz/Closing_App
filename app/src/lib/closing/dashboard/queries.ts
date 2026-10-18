import { cache } from "react";

import { prisma } from "@/lib/db";
import { isManagerRole } from "@/lib/roles";

import { DAY_MS } from "../constants";
import { hasReason } from "../engagement/reasons";
import { deadState, REVIVAL_ALERT_TYPES, REVIVAL_VISIBLE_DAYS, revivalSignal } from "../revival";
import type { FeedSource } from "./feed";
import type { FunnelLinkFacts } from "./funnel";
import { dealLabel, firstProspect, linkLabelSelect } from "./labels";
import type { OpenDealStatus } from "./next-action";
import type { SellerProgress } from "./seller-stage";

/**
 * Every read of the "Aujourd'hui" page. Scoped to the workspace, or to one
 * seller's deals when `owner` is given, bots left out. Turning rows into figures and sentences is left to the pure modules
 * next to this file.
 */

/** Follow-ups that will go out without the seller doing anything. */
export const PLANNED_FOLLOWUP_STATUSES = ["PENDING", "GENERATED", "SCHEDULED"] as const;
/** Kinds of logged exchange that mean the seller and the prospect talked. */
export const CONTACT_ACTIVITY_TYPES = ["CALL", "EMAIL_REPLY_RECEIVED", "MEETING", "MANUAL_SEND"] as const;
const FEED_TAKE = 15;
/** Open deals loaded for the temperature bar and the "À traiter" list. */
const DEALS_TAKE = 200;
/** Cohort size the funnel is computed on; beyond that it undercounts. */
const COHORT_TAKE = 2000;

/** One seller's deals: the links they created, plus orphan links for the workspace owner. */
export type SellerScope = { userId: string; isOwner: boolean };

export function sellerLinks(scope: SellerScope) {
  return scope.isOwner
    ? { OR: [{ createdById: scope.userId }, { createdById: null }] }
    : { createdById: scope.userId };
}

/**
 * What sellerStage() reads: documents in, links gone out, links opened. The seller's own personal
 * links: onboarding tests and open links aside (an open link's readers get links of their own).
 * Archived ones count, they did go out. Counts stop at one where that is enough. Cached per request:
 * the layout's banner and the page both ask.
 */
export const getSellerProgress = cache(async function getSellerProgress(
  organizationId: string,
  scope: SellerScope,
): Promise<SellerProgress> {
  const mine = { organizationId, isOnboardingTest: false, shared: false, ...sellerLinks(scope) };
  const [documents, sent, read] = await Promise.all([
    prisma.document.count({ where: { organizationId, archivedAt: null } }),
    // Copied counts as gone out, as on "Aujourd'hui"; a link without draftAt was sent
    prisma.link.count({ where: { ...mine, AND: { OR: [{ draftAt: null }, { copiedAt: { not: null } }] } }, take: 1 }),
    prisma.link.count({ where: { ...mine, views: { some: { isBot: false } } }, take: 1 }),
  ]);
  return { documents, sent, read };
});

/** Anyone in the workspace may read a deal; only its seller and the managers change it. */
type DealEditor = { role: string; scope: SellerScope };

export function editableLinks(editor: DealEditor) {
  return isManagerRole(editor.role) ? {} : sellerLinks(editor.scope);
}

export function canEditDeal(createdById: string | null, editor: DealEditor) {
  return (
    isManagerRole(editor.role) ||
    createdById === editor.scope.userId ||
    (createdById === null && editor.scope.isOwner)
  );
}

/** Deals still in play, with what the "À traiter" list and the temperature bar need. */
export async function getOpenDeals(
  organizationId: string,
  scope: {
    owner?: SellerScope;
    take?: number;
    withValidated?: boolean;
    /** Archived deals the prospect came back to lately: the seller's to reopen. */
    withRevived?: boolean;
  } = {},
) {
  const now = new Date();
  const revivedSince = new Date(now.getTime() - REVIVAL_VISIBLE_DAYS * DAY_MS);
  const deals = await prisma.link.findMany({
    where: {
      organizationId,
      draftAt: null,
      // A shared link is a source of leads, not a deal; its readers count once they show interest
      shared: false,
      // In AND: the seller scope below brings its own OR
      AND: [
        {
          OR: [
            { parentLinkId: null },
            { dealStatus: { not: "OPEN" } },
            { engagementScore: { tier: { in: ["HOT", "WARM"] } } },
          ],
        },
        scope.withRevived
          ? {
              OR: [
                { archivedAt: null },
                { alerts: { some: { type: { in: [...REVIVAL_ALERT_TYPES] }, createdAt: { gte: revivedSince } } } },
              ],
            }
          : { archivedAt: null },
      ],
      dealStatus: { in: scope.withValidated ? ["OPEN", "CHANGE_REQUESTED", "VALIDATED"] : ["OPEN", "CHANGE_REQUESTED"] },
      ...(scope.owner && sellerLinks(scope.owner)),
    },
    orderBy: { createdAt: "desc" },
    take: scope.take ?? DEALS_TAKE,
    select: {
      id: true,
      name: true,
      slug: true,
      dealStatus: true,
      createdById: true,
      dealAmountCents: true,
      dealCurrency: true,
      decisionDeadline: true,
      sentAt: true,
      createdAt: true,
      lastActivityAt: true,
      followupsEnabled: true,
      snoozedUntil: true,
      meetingBookedAt: true,
      meetingAt: true,
      quoteRequestedAt: true,
      archivedAt: true,
      expiresAt: true,
      engagementScore: { select: { score: true, tier: true, reasons: true } },
      document: { select: { name: true, displayTitle: true, docType: true, numPages: true, archivedAt: true } },
      alerts: {
        where: { type: { in: [...REVIVAL_ALERT_TYPES] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { type: true, createdAt: true },
      },
      prospects: firstProspect,
      followups: {
        where: { status: { in: [...PLANNED_FOLLOWUP_STATUSES] } },
        orderBy: { scheduledFor: "asc" },
        take: 1,
        select: { scheduledFor: true, channel: true, timezone: true },
      },
      views: { where: { isBot: false }, orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
      sellerActivities: {
        where: { type: { in: [...CONTACT_ACTIVITY_TYPES] } },
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true },
      },
      _count: { select: { followups: { where: { status: "DRAFT" } } } },
      insights: {
        where: { model: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          headline: true,
          priority: true,
          stage: true,
          momentum: true,
          recommendedAction: true,
          createdAt: true,
        },
      },
    },
  });

  const rows = deals.map(({ views, sellerActivities, _count, insights, alerts, ...deal }) => {
    // .at() keeps "maybe none" in the types, unlike destructuring
    const lastView = views.at(0);
    return {
      ...deal,
      revival: revivalSignal(deadState(deal, now), alerts.at(0) ?? null),
      insight: insights.at(0) ?? null,
      draftCount: _count.followups,
      lastSellerContactAt: sellerActivities.at(0)?.occurredAt ?? null,
      dealStatus: deal.dealStatus as OpenDealStatus,
      opened: lastView !== undefined,
      // Only flushes with reading time set lastActivityAt: a prospect who
      // closed the tab right away still opened the link.
      lastActivityAt: deal.lastActivityAt ?? lastView?.lastSeenAt ?? null,
      pricingFocus: hasReason(deal.engagementScore?.reasons, "pricing_focus"),
    };
  });
  // An archived deal is only back for a return after it was archived, not one from its previous life
  return rows.filter((row) => !row.archivedAt || row.revival);
}

export type OpenDeal = Awaited<ReturnType<typeof getOpenDeals>>[number];

/** Reading time per page for each link, bots and the seller's own reads aside. */
export async function getPageReadings(linkIds: string[]) {
  if (linkIds.length === 0) return new Map<string, { pageNumber: number; durationMs: number }[]>();
  const rows = await prisma.pageView.groupBy({
    by: ["linkId", "pageNumber"],
    where: { linkId: { in: linkIds }, view: { isBot: false } },
    _sum: { totalDurationMs: true },
  });
  const byLink = new Map<string, { pageNumber: number; durationMs: number }[]>();
  for (const row of rows) {
    const pages = byLink.get(row.linkId) ?? [];
    pages.push({ pageNumber: row.pageNumber, durationMs: row._sum.totalDurationMs ?? 0 });
    byLink.set(row.linkId, pages);
  }
  return byLink;
}

/** Links sent since `since` (all links when null), and how far each one went. */
export async function getFunnelFacts(
  organizationId: string,
  since: Date | null,
  owner?: SellerScope,
): Promise<FunnelLinkFacts[]> {
  const links = await prisma.link.findMany({
    where: {
      organizationId,
      archivedAt: null,
      // ORs side by side would replace one another: each sits in the AND
      AND: [
        // Sent, or copied by the seller: as far as they know it went out
        { OR: [{ draftAt: null }, { copiedAt: { not: null } }] },
        since ? { OR: [{ sentAt: { gte: since } }, { sentAt: null, createdAt: { gte: since } }] } : {},
        owner ? sellerLinks(owner) : {},
      ],
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

export async function getFeedSource(
  organizationId: string,
  since: Date | null,
  owner?: SellerScope,
): Promise<FeedSource> {
  const workspaceLinks = { organizationId, ...(owner && sellerLinks(owner)) };
  const ofWorkspace = { link: { ...workspaceLinks, archivedAt: null } };

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
        link: { select: linkLabelSelect },
      },
    }),
    prisma.prospectAction.findMany({
      where: {
        link: workspaceLinks,
        // A prospect asking for an archived document again is news, the link's state aside
        OR: [{ link: { archivedAt: null } }, { type: "REQUEST_RELINK" }],
        ...(since && { createdAt: { gte: since } }),
      },
      orderBy: { createdAt: "desc" },
      take: FEED_TAKE,
      select: {
        id: true,
        createdAt: true,
        type: true,
        message: true,
        prospect: { select: { name: true, email: true, company: true } },
        link: { select: linkLabelSelect },
      },
    }),
    prisma.sellerAlert.findMany({
      where: {
        link: workspaceLinks,
        OR: [{ link: { archivedAt: null } }, { type: "DEAD_LINK_OPENED" }],
        type: {
          notIn: ["PROSPECT_VALIDATED", "CHANGE_REQUESTED", "QUOTE_REQUESTED", "MEETING_BOOKED", "LINK_EXTENSION_REQUESTED", "RELINK_REQUESTED"],
        },
        ...(since && { createdAt: { gte: since } }),
      },
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
      linkLabel: dealLabel(view.link),
      reader: view.prospect?.name ?? view.prospect?.email ?? view.email,
      documentName: view.link.document.name,
      totalDurationMs: view.totalDurationMs,
      pricingDurationMs: pricingByView.get(view.id) ?? 0,
    })),
    actions: actions.map((action) => ({
      id: action.id,
      createdAt: action.createdAt,
      linkId: action.link.id,
      who: action.prospect?.company ?? action.prospect?.name ?? dealLabel(action.link),
      linkLabel: dealLabel(action.link),
      type: action.type,
      documentName: action.link.document.name,
      message: action.message,
    })),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      createdAt: alert.createdAt,
      linkId: alert.link.id,
      linkLabel: dealLabel(alert.link),
      documentName: alert.link.document.name,
      type: alert.type,
      payload: alert.payload,
    })),
    followups: followups.map((followup) => ({
      id: followup.id,
      sentAt: followup.sentAt!,
      linkId: followup.link.id,
      who: followup.prospect.company ?? followup.prospect.name ?? dealLabel(followup.link),
      linkLabel: dealLabel(followup.link),
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

export function getUpcomingFollowups(organizationId: string, owner?: SellerScope) {
  return prisma.followup.findMany({
    where: {
      link: { organizationId, archivedAt: null, ...(owner && sellerLinks(owner)) },
      status: { in: ["GENERATED", "SCHEDULED"] },
    },
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
export async function getFreshValidations(organizationId: string, now: Date, owner?: SellerScope) {
  const actions = await prisma.prospectAction.findMany({
    where: {
      link: { organizationId, ...(owner && sellerLinks(owner)) },
      type: "VALIDATE_SIGN",
      createdAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      prospect: { select: { company: true } },
      link: { select: linkLabelSelect },
    },
  });
  return actions.map((action) => action.prospect?.company ?? dealLabel(action.link));
}

/** Follow-ups written and waiting for the seller's go, oldest slot first. */
export function getDraftsToReview(organizationId: string, owner?: SellerScope) {
  return prisma.followup.findMany({
    where: { link: { organizationId, archivedAt: null, ...(owner && sellerLinks(owner)) }, status: "DRAFT" },
    orderBy: { scheduledFor: "asc" },
    take: 6,
    select: {
      id: true,
      channel: true,
      subject: true,
      link: { select: { id: true } },
      prospect: { select: { name: true, email: true, company: true } },
    },
  });
}

