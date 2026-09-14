import { describe, expect, it } from "vitest";

import { computeEngagementScore, type EngagementInput } from "./scoring";

const now = new Date("2026-09-15T10:00:00Z");

const base: EngagementInput = {
  now,
  dealStatus: "OPEN",
  lastActivityAt: null,
  totalDurationMs: 0,
  visitCount: 0,
  uniqueViewers: 0,
  pricingDurationMs: 0,
  pricingThresholdMs: 90_000,
  completionRatio: 0,
};

describe("computeEngagementScore", () => {
  it("is COLD with no activity", () => {
    expect(computeEngagementScore(base)).toEqual({ score: 0, tier: "COLD", reasons: [] });
  });

  it("is HOT for a recent, repeated, pricing-focused read by several people", () => {
    const result = computeEngagementScore({
      ...base,
      lastActivityAt: new Date(now.getTime() - 60 * 60 * 1000),
      totalDurationMs: 6 * 60 * 1000,
      visitCount: 3,
      uniqueViewers: 2,
      pricingDurationMs: 120_000,
      completionRatio: 1,
    });
    expect(result.tier).toBe("HOT");
    expect(result.score).toBe(100);
    expect(result.reasons.map((r) => r.code)).toContain("pricing_focus");
  });

  it("is WARM for a single full read a few days ago", () => {
    const result = computeEngagementScore({
      ...base,
      lastActivityAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      totalDurationMs: 3 * 60 * 1000,
      visitCount: 1,
      uniqueViewers: 1,
      pricingDurationMs: 40_000,
      completionRatio: 1,
    });
    // 15 recency + 15 reading + 5 visit + 7 pricing interest + 10 read to end
    expect(result.score).toBe(52);
    expect(result.tier).toBe("WARM");
  });

  it("forces HOT when the prospect validated", () => {
    expect(computeEngagementScore({ ...base, dealStatus: "VALIDATED" }).tier).toBe("HOT");
  });

  it("forces COLD when the deal is lost", () => {
    const result = computeEngagementScore({ ...base, dealStatus: "LOST", visitCount: 5 });
    expect(result).toMatchObject({ score: 0, tier: "COLD" });
  });
});
