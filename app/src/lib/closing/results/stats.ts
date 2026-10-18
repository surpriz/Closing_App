import { getLocalParts } from "../scheduling/business-hours";

/**
 * "Ce qui marche": what the follow-ups led to, and what won deals did differently from lost ones.
 * Pure: rows in, figures out.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** A meeting booked this soon after a follow-up is credited to it. */
export const MEETING_CREDIT_MS = 14 * DAY_MS;
/** Below this many messages a rate says nothing. */
export const MIN_SAMPLE = 5;

export type FollowupRow = {
  trigger: string;
  /** The deal analysis' goal (AI decisions), null otherwise. */
  goal: string | null;
  sentAt: Date;
  timezone: string;
  clickedAt: Date | null;
  repliedAt: Date | null;
  bouncedAt: Date | null;
  meetingBookedAt: Date | null;
};

export type OutcomeGroup = { key: string; sent: number; clicked: number; replied: number; meetings: number; bounced: number };

function outcomes(row: FollowupRow) {
  const meeting =
    !!row.meetingBookedAt &&
    row.meetingBookedAt >= row.sentAt &&
    row.meetingBookedAt.getTime() - row.sentAt.getTime() <= MEETING_CREDIT_MS;
  return { clicked: !!row.clickedAt, replied: !!row.repliedAt, meeting, bounced: !!row.bouncedAt };
}

export function groupOutcomes(rows: FollowupRow[], keyOf: (row: FollowupRow) => string | null): OutcomeGroup[] {
  const groups = new Map<string, OutcomeGroup>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    const group = groups.get(key) ?? { key, sent: 0, clicked: 0, replied: 0, meetings: 0, bounced: 0 };
    const o = outcomes(row);
    group.sent++;
    if (o.clicked) group.clicked++;
    if (o.replied) group.replied++;
    if (o.meeting) group.meetings++;
    if (o.bounced) group.bounced++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.sent - a.sent || a.key.localeCompare(b.key));
}

/** Local hour the prospect received it at, as "09", "14"… */
export function sendHourKey(row: FollowupRow) {
  try {
    return String(getLocalParts(row.sentAt, row.timezone).hour).padStart(2, "0");
  } catch {
    return null;
  }
}

/** A follow-up "worked" when it got a reply or a meeting. */
export function successRate(group: OutcomeGroup) {
  if (group.sent < MIN_SAMPLE) return null;
  return (group.replied + group.meetings) / group.sent;
}

export type ClosedDealRow = {
  status: "WON" | "LOST";
  readingMs: number;
  visits: number;
  readers: number;
  pricingRead: boolean;
  sentAt: Date | null;
  closedAt: Date | null;
  reason: string | null;
};

export type DealProfile = {
  count: number;
  readingMs: number | null;
  visits: number | null;
  readers: number | null;
  pricingShare: number | null;
  daysToClose: number | null;
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Medians, so one deal read for hours does not make the average. */
export function dealProfile(rows: ClosedDealRow[]): DealProfile {
  return {
    count: rows.length,
    readingMs: median(rows.map((r) => r.readingMs)),
    visits: median(rows.map((r) => r.visits)),
    readers: median(rows.map((r) => r.readers)),
    pricingShare: rows.length ? rows.filter((r) => r.pricingRead).length / rows.length : null,
    daysToClose: median(
      rows.flatMap((r) => (r.sentAt && r.closedAt ? [Math.max(0, (r.closedAt.getTime() - r.sentAt.getTime()) / DAY_MS)] : [])),
    ),
  };
}

export function lostReasons(rows: ClosedDealRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "LOST") continue;
    const reason = row.reason ?? "UNKNOWN";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export type AlertRow = { userId: string; createdAt: Date; seenAt: Date | null };

/** How fast each seller opened the deal after an alert that called for them. */
export function reactionTimes(rows: AlertRow[], now: Date) {
  const bySeller = new Map<string, AlertRow[]>();
  for (const row of rows) bySeller.set(row.userId, [...(bySeller.get(row.userId) ?? []), row]);
  return [...bySeller.entries()].map(([userId, alerts]) => {
    const delays = alerts.flatMap((a) => (a.seenAt ? [a.seenAt.getTime() - a.createdAt.getTime()] : []));
    // An alert older than a day and never followed counts as missed
    const missed = alerts.filter((a) => !a.seenAt && now.getTime() - a.createdAt.getTime() > DAY_MS).length;
    return {
      userId,
      alerts: alerts.length,
      medianMs: median(delays),
      withinHour: alerts.length ? delays.filter((d) => d <= 60 * 60 * 1000).length / alerts.length : 0,
      missed,
    };
  });
}

/**
 * One short line for the deal analysis: which goals got answers in this workspace. Only goals
 * with enough messages, best first. Null when there is not enough history to learn from.
 */
export function learningsLine(byGoal: OutcomeGroup[]) {
  const rated = byGoal
    .map((group) => ({ goal: group.key, rate: successRate(group), sent: group.sent }))
    .filter((g): g is { goal: string; rate: number; sent: number } => g.rate !== null)
    .sort((a, b) => b.rate - a.rate);
  if (rated.length < 2) return null;
  return rated.map((g) => `${g.goal}: ${Math.round(g.rate * 100)}% (${g.sent})`).join(", ");
}
