import { DAY_MS, TEAM_HEALTH } from "../constants";

import { currentInsight } from "./deal-action";
import type { OpenDeal } from "./queries";

/**
 * Where each open deal of the team stands, for the manager's page: hot, at
 * risk, dead, or simply moving along. Every verdict carries the signals
 * behind it, so the manager can see why without opening the deal. Pure.
 */

export type DealHealth = "hot" | "at_risk" | "dead" | "steady";

export type HealthSignal =
  | { code: "reading_now" | "change_requested" | "tier_hot" | "ai_priority" | "pricing_focus" }
  | { code: "cooling" | "ai_likely_lost" | "ai_stalled" | "ai_close_lost" }
  | { code: "quiet" | "unopened" | "never_opened" | "silent"; days: number }
  | { code: "deadline_passed"; date: Date };

export type HealthInput = Pick<
  OpenDeal,
  | "dealStatus"
  | "opened"
  | "sentAt"
  | "createdAt"
  | "lastActivityAt"
  | "snoozedUntil"
  | "decisionDeadline"
  | "pricingFocus"
  | "engagementScore"
  | "insight"
>;

const daysSince = (date: Date, now: Date) => Math.floor((now.getTime() - date.getTime()) / DAY_MS);

export function classifyDeal(
  deal: HealthInput,
  now: Date,
  readingNow: boolean,
): { health: DealHealth; signals: HealthSignal[] } {
  // What is happening right now beats any reading of the past
  const live: HealthSignal[] = [];
  if (readingNow) live.push({ code: "reading_now" });
  if (deal.dealStatus === "CHANGE_REQUESTED") live.push({ code: "change_requested" });
  if (live.length > 0) return { health: "hot", signals: live };

  const ai = currentInsight(deal);
  // A snoozed deal is quiet on purpose: silence says nothing until it wakes up
  const timed = !(deal.snoozedUntil && deal.snoozedUntil > now);
  const sentDays = daysSince(deal.sentAt ?? deal.createdAt, now);
  const quietDays = deal.opened && deal.lastActivityAt ? daysSince(deal.lastActivityAt, now) : null;
  // The stored tier and the last analysis only move on a new reading: past a
  // week of silence they describe an old deal, not this one
  const recent = quietDays !== null && quietDays < TEAM_HEALTH.quietRiskDays;

  // Dead before hot: a HOT tier is no longer refreshed once reading stops
  const dead: HealthSignal[] = [];
  if (ai.stage === "LIKELY_LOST") dead.push({ code: "ai_likely_lost" });
  if (ai.stage === "STALLED") dead.push({ code: "ai_stalled" });
  if (ai.advice?.type === "close_lost") dead.push({ code: "ai_close_lost" });
  if (timed && !deal.opened && sentDays >= TEAM_HEALTH.neverOpenedDeadDays) {
    dead.push({ code: "never_opened", days: sentDays });
  }
  if (timed && quietDays !== null && quietDays >= TEAM_HEALTH.silentDeadDays) {
    dead.push({ code: "silent", days: quietDays });
  }
  // Deadlines are stored at noon UTC: the deal stays alive the whole day
  if (deal.decisionDeadline && deal.decisionDeadline.getTime() + DAY_MS / 2 < now.getTime()) {
    dead.push({ code: "deadline_passed", date: deal.decisionDeadline });
  }
  if (dead.length > 0) return { health: "dead", signals: dead };

  const hot: HealthSignal[] = [];
  if (recent && deal.engagementScore?.tier === "HOT") hot.push({ code: "tier_hot" });
  if (recent && (ai.aiPriority ?? 0) >= TEAM_HEALTH.aiHotPriority) hot.push({ code: "ai_priority" });
  if (deal.pricingFocus && quietDays !== null && quietDays <= TEAM_HEALTH.pricingHotDays) {
    hot.push({ code: "pricing_focus" });
  }
  if (hot.length > 0) return { health: "hot", signals: hot };

  const risk: HealthSignal[] = [];
  if (ai.momentum === "COOLING") risk.push({ code: "cooling" });
  if (timed && quietDays !== null && quietDays >= TEAM_HEALTH.quietRiskDays) {
    risk.push({ code: "quiet", days: quietDays });
  }
  if (timed && !deal.opened && sentDays >= TEAM_HEALTH.unopenedRiskDays) {
    risk.push({ code: "unopened", days: sentDays });
  }
  if (risk.length > 0) return { health: "at_risk", signals: risk };

  return { health: "steady", signals: [] };
}

/** Amounts in cents, per currency: deals in euros and dollars are not added up. */
export type Money = Record<string, number>;

export type SellerSummary = {
  sellerId: string;
  open: number;
  hot: number;
  atRisk: number;
  dead: number;
  /** What the deals still alive are worth. */
  pipeline: Money;
  /** What the dead deals were worth. */
  deadAmount: Money;
};

export type SummaryRow = {
  sellerId: string;
  health: DealHealth;
  amountCents: number | null;
  currency: string | null;
};

const DEFAULT_CURRENCY = "EUR";

function add(money: Money, cents: number | null, currency: string | null) {
  if (cents === null) return;
  const key = currency ?? DEFAULT_CURRENCY;
  money[key] = (money[key] ?? 0) + cents;
}

/** One line per seller, in the order sellers first appear. */
export function summarizeBySeller(rows: SummaryRow[]): SellerSummary[] {
  const bySeller = new Map<string, SellerSummary>();
  for (const row of rows) {
    let summary = bySeller.get(row.sellerId);
    if (!summary) {
      summary = { sellerId: row.sellerId, open: 0, hot: 0, atRisk: 0, dead: 0, pipeline: {}, deadAmount: {} };
      bySeller.set(row.sellerId, summary);
    }
    summary.open += 1;
    if (row.health === "hot") summary.hot += 1;
    if (row.health === "at_risk") summary.atRisk += 1;
    if (row.health === "dead") {
      summary.dead += 1;
      add(summary.deadAmount, row.amountCents, row.currency);
    } else {
      add(summary.pipeline, row.amountCents, row.currency);
    }
  }
  return [...bySeller.values()];
}
