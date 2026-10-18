import { prisma } from "@/lib/db";

import { sellerLinks, type SellerScope } from "../dashboard/queries";
import {
  dealProfile,
  groupOutcomes,
  learningsLine,
  lostReasons,
  reactionTimes,
  sendHourKey,
  type ClosedDealRow,
  type FollowupRow,
} from "./stats";

const DAY_MS = 24 * 60 * 60 * 1000;
export const RESULTS_FOLLOWUP_DAYS = 90;
export const RESULTS_DEAL_DAYS = 180;
const REACTION_DAYS = 30;

function goalOf(context: unknown) {
  const goal = (context as { brief?: { goal?: unknown } } | null)?.brief?.goal;
  return typeof goal === "string" ? goal : null;
}

async function followupRows(organizationId: string, owner: SellerScope | null, now: Date): Promise<FollowupRow[]> {
  const rows = await prisma.followup.findMany({
    where: {
      status: { in: ["SENT", "DELIVERED"] },
      sentAt: { gte: new Date(now.getTime() - RESULTS_FOLLOWUP_DAYS * DAY_MS) },
      link: { organizationId, isOnboardingTest: false, ...(owner && sellerLinks(owner)) },
    },
    select: {
      trigger: true,
      context: true,
      sentAt: true,
      timezone: true,
      clickedAt: true,
      repliedAt: true,
      bouncedAt: true,
      link: { select: { meetingBookedAt: true } },
    },
    take: 5000,
  });
  return rows.map((row) => ({
    trigger: row.trigger,
    goal: row.trigger === "AI_DECISION" ? goalOf(row.context) : null,
    sentAt: row.sentAt!,
    timezone: row.timezone,
    clickedAt: row.clickedAt,
    repliedAt: row.repliedAt,
    bouncedAt: row.bouncedAt,
    meetingBookedAt: row.link.meetingBookedAt,
  }));
}

/** Everything the "Résultats" page shows, for one seller or the whole workspace (owner = null). */
export async function getResults(organizationId: string, owner: SellerScope | null, now = new Date()) {
  const [followups, deals, alerts] = await Promise.all([
    followupRows(organizationId, owner, now),
    prisma.link.findMany({
      where: {
        organizationId,
        isOnboardingTest: false,
        dealStatus: { in: ["WON", "LOST"] },
        closedAt: { gte: new Date(now.getTime() - RESULTS_DEAL_DAYS * DAY_MS) },
        ...(owner && sellerLinks(owner)),
      },
      select: {
        dealStatus: true,
        sentAt: true,
        closedAt: true,
        closedReason: true,
        engagementScore: { select: { totalDurationMs: true, visitCount: true, uniqueViewers: true, reasons: true } },
      },
      take: 2000,
    }),
    prisma.sellerAlert.findMany({
      where: {
        link: { organizationId, ...(owner && sellerLinks(owner)) },
        userId: owner ? owner.userId : { not: null },
        priority: { in: ["ACTION", "CALL"] },
        createdAt: { gte: new Date(now.getTime() - REACTION_DAYS * DAY_MS) },
      },
      select: { userId: true, createdAt: true, seenAt: true },
      take: 5000,
    }),
  ]);

  const closed: ClosedDealRow[] = deals.map((deal) => {
    const reasons = (deal.engagementScore?.reasons ?? []) as { code?: string }[];
    return {
      status: deal.dealStatus as "WON" | "LOST",
      readingMs: deal.engagementScore?.totalDurationMs ?? 0,
      visits: deal.engagementScore?.visitCount ?? 0,
      readers: deal.engagementScore?.uniqueViewers ?? 0,
      pricingRead: reasons.some((r) => r.code === "pricing_focus" || r.code === "pricing_interest"),
      sentAt: deal.sentAt,
      closedAt: deal.closedAt,
      reason: deal.closedReason,
    };
  });

  return {
    sent: followups.length,
    byTrigger: groupOutcomes(followups, (row) => row.trigger),
    byGoal: groupOutcomes(followups, (row) => row.goal),
    byHour: groupOutcomes(followups, sendHourKey).sort((a, b) => a.key.localeCompare(b.key)),
    won: dealProfile(closed.filter((d) => d.status === "WON")),
    lost: dealProfile(closed.filter((d) => d.status === "LOST")),
    lostReasons: lostReasons(closed),
    reactions: reactionTimes(
      alerts.flatMap((a) => (a.userId ? [{ userId: a.userId, createdAt: a.createdAt, seenAt: a.seenAt }] : [])),
      now,
    ),
  };
}

export type Results = Awaited<ReturnType<typeof getResults>>;

const LEARNINGS_TTL_MS = 30 * 60 * 1000;
const learningsCache = new Map<string, { at: number; line: Promise<string | null> }>();

/**
 * What this workspace's follow-ups taught, for the deal analysis. Null without enough history.
 * Kept half an hour per workspace: a batch of analyses reads it once.
 */
export function workspaceLearnings(organizationId: string, now = new Date()) {
  const cached = learningsCache.get(organizationId);
  if (cached && now.getTime() - cached.at < LEARNINGS_TTL_MS) return cached.line;
  const line = followupRows(organizationId, null, now)
    .then((rows) => learningsLine(groupOutcomes(rows, (row) => row.goal)))
    .catch(() => null);
  learningsCache.set(organizationId, { at: now.getTime(), line });
  return line;
}
