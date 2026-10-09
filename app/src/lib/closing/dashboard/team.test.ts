import { describe, expect, it } from "vitest";

import { classifyDeal, type HealthInput, summarizeBySeller } from "./team";

const now = new Date("2026-10-09T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(now.getTime() - days * DAY);

const insight = (fields: Partial<NonNullable<HealthInput["insight"]>>): HealthInput["insight"] => ({
  headline: "Analyse",
  priority: 3,
  stage: "EVALUATING",
  momentum: "STEADY",
  recommendedAction: { type: "wait", timing: "in_1_week" },
  createdAt: ago(1),
  ...fields,
});

const deal = (fields: Partial<HealthInput> = {}): HealthInput => ({
  dealStatus: "OPEN",
  opened: true,
  sentAt: ago(10),
  createdAt: ago(10),
  lastActivityAt: ago(2),
  snoozedUntil: null,
  decisionDeadline: null,
  pricingFocus: false,
  engagementScore: { score: 50, tier: "WARM", reasons: [] },
  insight: null,
  ...fields,
});

const health = (input: HealthInput, readingNow = false) => classifyDeal(input, now, readingNow).health;
const codes = (input: HealthInput, readingNow = false) =>
  classifyDeal(input, now, readingNow).signals.map((signal) => signal.code);

describe("classifyDeal", () => {
  it("leaves a deal moving along as steady", () => {
    expect(classifyDeal(deal(), now, false)).toEqual({ health: "steady", signals: [] });
  });

  describe("hot", () => {
    it("puts a live reader or a change request first, even on a dead-looking deal", () => {
      const late = deal({ decisionDeadline: ago(3) });
      expect(codes(late, true)).toEqual(["reading_now"]);
      expect(codes({ ...late, dealStatus: "CHANGE_REQUESTED" })).toEqual(["change_requested"]);
    });

    it("trusts the HOT tier only once the link was opened", () => {
      const tier = { score: 80, tier: "HOT" as const, reasons: [] };
      expect(codes(deal({ engagementScore: tier }))).toEqual(["tier_hot"]);
      expect(health(deal({ engagementScore: tier, opened: false, lastActivityAt: null, sentAt: ago(1) }))).toBe(
        "steady",
      );
    });

    it("follows a high AI priority while the analysis is current", () => {
      expect(codes(deal({ insight: insight({ priority: 4 }) }))).toEqual(["ai_priority"]);
    });

    it("stops trusting the tier and the analysis after a week of silence", () => {
      const tier = { score: 80, tier: "HOT" as const, reasons: [] };
      expect(codes(deal({ engagementScore: tier, lastActivityAt: ago(6) }))).toEqual(["tier_hot"]);
      expect(codes(deal({ engagementScore: tier, lastActivityAt: ago(10) }))).toEqual(["quiet"]);
      expect(codes(deal({ lastActivityAt: ago(12), insight: insight({ priority: 5, createdAt: ago(11) }) }))).toEqual([
        "quiet",
      ]);
    });

    it("ignores an analysis older than the last reading", () => {
      expect(health(deal({ lastActivityAt: ago(1), insight: insight({ priority: 5, createdAt: ago(2) }) }))).toBe(
        "steady",
      );
    });

    it("counts a pricing read for a week", () => {
      expect(codes(deal({ pricingFocus: true, lastActivityAt: ago(6) }))).toEqual(["pricing_focus"]);
      expect(codes(deal({ pricingFocus: true, lastActivityAt: ago(8) }))).toEqual(["quiet"]);
    });
  });

  describe("dead", () => {
    it("follows the analysis when it reads the deal as lost or stalled", () => {
      expect(codes(deal({ insight: insight({ stage: "LIKELY_LOST" }) }))).toEqual(["ai_likely_lost"]);
      expect(codes(deal({ insight: insight({ stage: "STALLED" }) }))).toEqual(["ai_stalled"]);
      expect(codes(deal({ insight: insight({ recommendedAction: { type: "close_lost", timing: "now" } }) }))).toEqual([
        "ai_close_lost",
      ]);
    });

    it("beats a HOT tier left over from old readings", () => {
      const stale = deal({
        engagementScore: { score: 75, tier: "HOT", reasons: [] },
        insight: insight({ stage: "STALLED" }),
      });
      expect(health(stale)).toBe("dead");
    });

    it("gives up on a link never opened after 14 days", () => {
      const unopened = { opened: false, lastActivityAt: null };
      expect(classifyDeal(deal({ ...unopened, sentAt: ago(14) }), now, false).signals).toEqual([
        { code: "never_opened", days: 14 },
      ]);
      expect(classifyDeal(deal({ ...unopened, sentAt: ago(13) }), now, false).signals).toEqual([
        { code: "unopened", days: 13 },
      ]);
    });

    it("gives up after 21 days without a reading", () => {
      expect(classifyDeal(deal({ lastActivityAt: ago(21) }), now, false).signals).toEqual([
        { code: "silent", days: 21 },
      ]);
      expect(classifyDeal(deal({ lastActivityAt: ago(20) }), now, false).signals).toEqual([
        { code: "quiet", days: 20 },
      ]);
    });

    it("flags a decision deadline gone by", () => {
      expect(classifyDeal(deal({ decisionDeadline: ago(1) }), now, false).signals).toEqual([
        { code: "deadline_passed", date: ago(1) },
      ]);
    });

    it("keeps the deal alive on its deadline day", () => {
      // Stored at noon UTC, as the deal form saves it
      const today = new Date("2026-10-09T12:00:00Z");
      expect(health(deal({ decisionDeadline: today }))).toBe("steady");
      expect(classifyDeal(deal({ decisionDeadline: today }), new Date("2026-10-10T00:30:00Z"), false).health).toBe(
        "dead",
      );
    });

    it("counts from creation when the send date is unknown", () => {
      expect(codes(deal({ opened: false, lastActivityAt: null, sentAt: null, createdAt: ago(15) }))).toEqual([
        "never_opened",
      ]);
    });

    it("lists every reason at once", () => {
      expect(codes(deal({ lastActivityAt: ago(30), decisionDeadline: ago(2) }))).toEqual([
        "silent",
        "deadline_passed",
      ]);
    });
  });

  describe("at risk", () => {
    it("flags a cooling deal and one quiet for a week", () => {
      expect(codes(deal({ insight: insight({ momentum: "COOLING" }) }))).toEqual(["cooling"]);
      expect(codes(deal({ lastActivityAt: ago(7) }))).toEqual(["quiet"]);
      expect(health(deal({ lastActivityAt: ago(6) }))).toBe("steady");
    });

    it("flags a link still unopened after 5 days", () => {
      expect(codes(deal({ opened: false, lastActivityAt: null, sentAt: ago(5) }))).toEqual(["unopened"]);
      expect(health(deal({ opened: false, lastActivityAt: null, sentAt: ago(4) }))).toBe("steady");
    });

    it("counts from creation when the send date is unknown", () => {
      expect(codes(deal({ opened: false, lastActivityAt: null, sentAt: null, createdAt: ago(6) }))).toEqual([
        "unopened",
      ]);
    });
  });

  it("lets a snoozed deal stay quiet, but not past its deadline", () => {
    const snoozed = { snoozedUntil: new Date(now.getTime() + DAY) };
    expect(health(deal({ ...snoozed, lastActivityAt: ago(30) }))).toBe("steady");
    expect(health(deal({ ...snoozed, opened: false, lastActivityAt: null, sentAt: ago(30) }))).toBe("steady");
    expect(health(deal({ ...snoozed, decisionDeadline: ago(1) }))).toBe("dead");
    expect(health(deal({ ...snoozed, insight: insight({ stage: "STALLED" }) }))).toBe("dead");
    expect(health(deal({ ...snoozed, insight: insight({ momentum: "COOLING" }) }))).toBe("at_risk");
  });
});

describe("summarizeBySeller", () => {
  it("counts deals and sums amounts per currency, dead deals apart", () => {
    expect(
      summarizeBySeller([
        { sellerId: "a", health: "hot", amountCents: 100_00, currency: "EUR" },
        { sellerId: "b", health: "steady", amountCents: null, currency: null },
        { sellerId: "a", health: "dead", amountCents: 50_00, currency: null },
        { sellerId: "a", health: "at_risk", amountCents: 70_00, currency: "USD" },
      ]),
    ).toEqual([
      {
        sellerId: "a",
        open: 3,
        hot: 1,
        atRisk: 1,
        dead: 1,
        pipeline: { EUR: 100_00, USD: 70_00 },
        deadAmount: { EUR: 50_00 },
      },
      { sellerId: "b", open: 1, hot: 0, atRisk: 0, dead: 0, pipeline: {}, deadAmount: {} },
    ]);
  });
});
