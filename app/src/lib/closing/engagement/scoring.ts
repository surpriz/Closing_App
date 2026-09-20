import { ENGAGEMENT_TIER_THRESHOLDS } from "../constants";
import type { EngagementReason } from "../types";

export type EngagementTierValue = "HOT" | "WARM" | "COLD";
type DealStatusValue = "OPEN" | "VALIDATED" | "CHANGE_REQUESTED" | "WON" | "LOST";

export type EngagementInput = {
  now: Date;
  dealStatus: DealStatusValue;
  lastActivityAt: Date | null;
  totalDurationMs: number;
  visitCount: number;
  uniqueViewers: number;
  pricingDurationMs: number;
  pricingThresholdMs: number;
  completionRatio: number; // furthest page reached / page count, 0..1
};

export type EngagementResult = {
  score: number;
  tier: EngagementTierValue;
  reasons: EngagementReason[];
};

const HOUR = 60 * 60 * 1000;

function tierFor(score: number): EngagementTierValue {
  if (score >= ENGAGEMENT_TIER_THRESHOLDS.HOT) return "HOT";
  if (score >= ENGAGEMENT_TIER_THRESHOLDS.WARM) return "WARM";
  return "COLD";
}

// Deterministic and explainable on purpose: every point comes with a reason
// the seller can read. AI is used for writing messages, not for scoring.
export function computeEngagementScore(input: EngagementInput): EngagementResult {
  if (input.dealStatus === "VALIDATED" || input.dealStatus === "WON") {
    return { score: 100, tier: "HOT", reasons: [{ code: "deal_validated", weight: 100 }] };
  }
  if (input.dealStatus === "LOST") {
    return { score: 0, tier: "COLD", reasons: [{ code: "deal_lost", weight: 0 }] };
  }

  const reasons: EngagementReason[] = [];
  const add = (code: string, weight: number, detail?: string) => {
    if (weight > 0) reasons.push({ code, weight, detail });
  };

  if (input.lastActivityAt) {
    const age = input.now.getTime() - input.lastActivityAt.getTime();
    if (age <= 24 * HOUR) add("recent_activity_24h", 25);
    else if (age <= 72 * HOUR) add("recent_activity_3d", 15);
    else if (age <= 7 * 24 * HOUR) add("recent_activity_7d", 5);
  }

  const readingSeconds = Math.round(input.totalDurationMs / 1000);
  add("reading_time", Math.min(25, Math.round(readingSeconds / 12)), `${readingSeconds}s`);

  if (input.visitCount >= 3) add("repeat_visits", 20, String(input.visitCount));
  else if (input.visitCount === 2) add("repeat_visits", 12, "2");
  else if (input.visitCount === 1) add("first_visit", 5);

  if (input.uniqueViewers >= 3) add("multiple_viewers", 15, String(input.uniqueViewers));
  else if (input.uniqueViewers === 2) add("multiple_viewers", 10, "2");

  const pricingSeconds = Math.round(input.pricingDurationMs / 1000);
  if (input.pricingThresholdMs > 0 && input.pricingDurationMs >= input.pricingThresholdMs) {
    add("pricing_focus", 15, `${pricingSeconds}s`);
  } else if (input.pricingThresholdMs > 0 && input.pricingDurationMs >= input.pricingThresholdMs / 3) {
    add("pricing_interest", 7, `${pricingSeconds}s`);
  }

  if (input.completionRatio >= 0.9) add("read_to_end", 10);
  else if (input.completionRatio >= 0.5) add("read_halfway", 4);

  if (input.dealStatus === "CHANGE_REQUESTED") add("change_requested", 10);

  const score = Math.min(100, reasons.reduce((sum, r) => sum + r.weight, 0));
  return { score, tier: tierFor(score), reasons };
}
