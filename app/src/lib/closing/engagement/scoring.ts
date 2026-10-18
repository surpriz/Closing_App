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
  completionRatio: number; // furthest page reached / page count, or share of the video watched, 0..1
  isVideo?: boolean; // the document is an embedded video: completion means watching
  externalMs?: number; // time away on a site opened in a new tab, an estimate
  meetingClicked?: boolean; // opened the seller's booking page
  meetingBooked?: boolean; // and the widget confirmed a booking
  quoteRequested?: boolean; // asked for a quote under a video pitch
  contentTaken?: boolean; // copied a passage or printed: taking it elsewhere, often to show it internally
  replied?: boolean; // answered by email
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

  // Time on a site opened in a new tab is not seen, only guessed from the time away: it counts as reading
  const readingSeconds = Math.round((input.totalDurationMs + (input.externalMs ?? 0)) / 1000);
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

  const completion = input.isVideo ? "watched" : "read";
  if (input.completionRatio >= 0.9) add(`${completion}_to_end`, 10);
  else if (input.completionRatio >= 0.5) add(`${completion}_halfway`, 4);

  if (input.dealStatus === "CHANGE_REQUESTED") add("change_requested", 10);
  // As strong as a booking: the prospect asks to go further
  if (input.quoteRequested) add("quote_requested", 25);

  if (input.contentTaken) add("content_taken", 8);
  if (input.replied) add("email_replied", 20);

  // A booking replaces the intent: it is the same gesture, carried through
  if (input.meetingBooked) add("meeting_booked", 25);
  else if (input.meetingClicked) add("meeting_clicked", 5);

  const score = Math.min(100, reasons.reduce((sum, r) => sum + r.weight, 0));
  return { score, tier: tierFor(score), reasons };
}
