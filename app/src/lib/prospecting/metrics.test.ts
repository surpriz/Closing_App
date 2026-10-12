import { describe, expect, it } from "vitest";

import { providerMetrics } from "./metrics";
import { revealAllowance } from "./quota";

const suggestion = (provider: string, patch: Partial<Parameters<typeof providerMetrics>[0][number]> = {}) => ({
  provider,
  seniority: "director",
  nafVerified: true,
  status: "SUGGESTED",
  invalidReason: null,
  ...patch,
});

describe("providerMetrics", () => {
  it("compares providers on the same target", () => {
    const result = providerMetrics(
      [
        suggestion("APOLLO", { status: "READY" }),
        suggestion("APOLLO", { status: "INVALID", invalidReason: "UNVERIFIED", seniority: "manager" }),
        suggestion("APOLLO", { status: "INVALID", invalidReason: "DUPLICATE", nafVerified: null }),
        suggestion("LEMLIST", { status: "READY", nafVerified: false }),
      ],
      [
        { provider: "APOLLO", kind: "REVEAL", credits: 2 },
        { provider: "APOLLO", kind: "DELIVERED", credits: 1 },
        { provider: "LEMLIST", kind: "REVEAL", credits: 5 },
        { provider: "LEMLIST", kind: "DELIVERED", credits: 1 },
      ],
    );

    expect(result).toEqual([
      {
        provider: "APOLLO",
        found: 3,
        decisionMakerRate: 2 / 3,
        verifiedCompanyRate: 1,
        revealed: 2, // the duplicate is not the provider's fault
        validEmailRate: 0.5,
        creditsSpent: 2,
        delivered: 1,
        creditsPerDelivered: 2,
      },
      {
        provider: "LEMLIST",
        found: 1,
        decisionMakerRate: 1,
        verifiedCompanyRate: 0,
        revealed: 1,
        validEmailRate: 1,
        creditsSpent: 5,
        delivered: 1,
        creditsPerDelivered: 5,
      },
    ]);
  });

  it("has no rates without data", () => {
    const [only] = providerMetrics([], [{ provider: "APOLLO", kind: "SEARCH", credits: 0 }]);
    expect(only.decisionMakerRate).toBeNull();
    expect(only.validEmailRate).toBeNull();
    expect(only.creditsPerDelivered).toBeNull();
  });
});

describe("revealAllowance", () => {
  it("never goes past the daily limit", () => {
    expect(revealAllowance({ revealsToday: 0, requested: 3, dailyLimit: 50 })).toBe(3);
    expect(revealAllowance({ revealsToday: 49, requested: 3, dailyLimit: 50 })).toBe(1);
    expect(revealAllowance({ revealsToday: 60, requested: 3, dailyLimit: 50 })).toBe(0);
  });
});
