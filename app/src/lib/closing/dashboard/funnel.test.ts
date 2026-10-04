import { describe, expect, it } from "vitest";

import { buildFunnel, buildHeatDistribution, isDeepRead, type FunnelLinkFacts } from "./funnel";
import { parsePeriod, periodStart } from "./period";

const unread: FunnelLinkFacts = {
  numPages: 10,
  viewCount: 0,
  maxPageReached: 1,
  totalDurationMs: 0,
  pricingFocus: false,
  validated: false,
};

describe("isDeepRead", () => {
  it("needs half of a PDF and 30 s of reading", () => {
    expect(isDeepRead({ ...unread, viewCount: 1, maxPageReached: 5, totalDurationMs: 30_000 })).toBe(true);
    expect(isDeepRead({ ...unread, viewCount: 1, maxPageReached: 4, totalDurationMs: 300_000 })).toBe(false);
    expect(isDeepRead({ ...unread, viewCount: 1, maxPageReached: 10, totalDurationMs: 29_000 })).toBe(false);
  });

  it("uses time alone for web documents", () => {
    const web = { ...unread, numPages: null, viewCount: 1 };
    expect(isDeepRead({ ...web, totalDurationMs: 60_000 })).toBe(true);
    expect(isDeepRead({ ...web, totalDurationMs: 59_000 })).toBe(false);
  });

  it("counts a long pricing read", () => {
    expect(isDeepRead({ ...unread, viewCount: 1, pricingFocus: true })).toBe(true);
  });

  it("never counts an unopened link", () => {
    expect(isDeepRead({ ...unread, pricingFocus: true })).toBe(false);
  });
});

describe("buildFunnel", () => {
  it("returns zeros for an empty cohort", () => {
    expect(buildFunnel([])).toEqual({ sent: 0, opened: 0, deep: 0, validated: 0 });
  });

  it("never grows from one step to the next", () => {
    const funnel = buildFunnel([
      unread,
      { ...unread, viewCount: 1, totalDurationMs: 5_000 },
      { ...unread, viewCount: 2, maxPageReached: 8, totalDurationMs: 120_000 },
      // Validated without reading: still counted on every step.
      { ...unread, validated: true },
    ]);
    expect(funnel).toEqual({ sent: 4, opened: 3, deep: 2, validated: 1 });
  });
});

describe("buildHeatDistribution", () => {
  it("keeps unread deals apart from cold ones", () => {
    expect(
      buildHeatDistribution([
        { opened: false, tier: null },
        { opened: false, tier: "COLD" },
        { opened: true, tier: "HOT" },
        { opened: true, tier: "WARM" },
        { opened: true, tier: null },
      ]),
    ).toEqual({ HOT: 1, WARM: 1, COLD: 1, unopened: 2 });
  });
});

describe("period", () => {
  const now = new Date("2026-10-04T10:00:00Z");

  it("falls back to 30 days", () => {
    expect(parsePeriod(undefined)).toBe("30d");
    expect(parsePeriod("90d")).toBe("30d");
    expect(parsePeriod(["7d", "all"])).toBe("30d");
    expect(parsePeriod("7d")).toBe("7d");
  });

  it("computes the window start", () => {
    expect(periodStart("7d", now)).toEqual(new Date("2026-09-27T10:00:00Z"));
    expect(periodStart("all", now)).toBeNull();
  });
});
