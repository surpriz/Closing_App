import { describe, expect, it } from "vitest";

import { HOUR_MS } from "@/lib/closing/constants";

import { RENEW_BEFORE_MS, subscriptionExpiry, subscriptionNeedsRenewal, SUBSCRIPTION_TTL_MIN } from "./subscriptions";

const now = new Date("2026-10-28T10:00:00Z");

describe("subscriptionNeedsRenewal", () => {
  it("renews inside the 36 hour window", () => {
    expect(subscriptionNeedsRenewal(new Date(now.getTime() + 35 * HOUR_MS), now)).toBe(true);
    expect(subscriptionNeedsRenewal(new Date(now.getTime() + RENEW_BEFORE_MS), now)).toBe(true);
  });
  it("leaves a fresh subscription alone", () => {
    expect(subscriptionNeedsRenewal(new Date(now.getTime() + 37 * HOUR_MS), now)).toBe(false);
  });
  it("renews an expired or unknown expiry", () => {
    expect(subscriptionNeedsRenewal(new Date(now.getTime() - HOUR_MS), now)).toBe(true);
    expect(subscriptionNeedsRenewal(null, now)).toBe(true);
  });
  it("asks Graph for less than the 10 080 minute maximum", () => {
    expect(SUBSCRIPTION_TTL_MIN).toBeLessThan(10_080);
    expect(subscriptionExpiry(now).getTime() - now.getTime()).toBe(SUBSCRIPTION_TTL_MIN * 60_000);
  });
});
