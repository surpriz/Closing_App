import { describe, expect, it } from "vitest";

import { checkoutOffer, offerEndsAt, offerFor } from "./offers";

describe("offerFor", () => {
  it("knows the cold email offer", () => {
    const offer = offerFor("cold-2026-11")!;
    expect(offer.trialDays).toBe(30);
    expect(offer.signupDeadline.toISOString()).toBe("2026-11-30T22:59:59.000Z");
    expect(offer.couponIds).toEqual({ month: "cold-2026-11-30off", year: "cold-2026-11-30off-year" });
    expect(offer.discountPercent).toBe(30);
    expect(offer.discountMonths).toBe(12);
  });

  it("rejects unknown or differently-cased codes", () => {
    expect(offerFor("COLD-2026-11")).toBeNull();
    expect(offerFor("nope")).toBeNull();
    expect(offerFor("toString")).toBeNull();
    expect(offerFor(null)).toBeNull();
    expect(offerFor(undefined)).toBeNull();
  });
});

describe("checkoutOffer", () => {
  const now = new Date("2026-11-10T10:00:00Z");
  const org = { offerCode: "cold-2026-11", trialEndsAt: new Date("2026-12-10T10:00:00Z") };

  const trialEnd = Date.parse("2026-12-10T10:00:00Z") / 1000;

  it("gives the monthly coupon and the trial end while the trial runs", () => {
    expect(checkoutOffer(org, now, "month")).toEqual({ couponId: "cold-2026-11-30off", trialEnd });
  });

  it("gives the yearly coupon on a yearly price", () => {
    expect(checkoutOffer(org, now, "year")).toEqual({ couponId: "cold-2026-11-30off-year", trialEnd });
  });

  it("drops trial_end when the trial ends in under 48 hours", () => {
    expect(checkoutOffer(org, new Date("2026-12-09T11:00:00Z"), "month")).toEqual({ couponId: "cold-2026-11-30off", trialEnd: null });
    expect(checkoutOffer(org, new Date("2026-12-09T11:00:00Z"), "year")).toEqual({ couponId: "cold-2026-11-30off-year", trialEnd: null });
  });

  it("is null once the trial is over, without an offer, or without a trial end", () => {
    expect(checkoutOffer(org, new Date("2026-12-10T10:00:00Z"), "month")).toBeNull();
    expect(checkoutOffer({ offerCode: null, trialEndsAt: org.trialEndsAt }, now, "month")).toBeNull();
    expect(checkoutOffer({ offerCode: "nope", trialEndsAt: org.trialEndsAt }, now, "year")).toBeNull();
    expect(checkoutOffer({ offerCode: org.offerCode, trialEndsAt: null }, now, "month")).toBeNull();
  });
});

describe("offerEndsAt", () => {
  const org = { offerCode: "cold-2026-11", trialEndsAt: new Date("2026-12-10T10:00:00Z") };

  it("is the trial end while the offer can still be taken", () => {
    expect(offerEndsAt(org, new Date("2026-11-10T10:00:00Z"))).toEqual(org.trialEndsAt);
  });

  it("is null afterwards", () => {
    expect(offerEndsAt(org, new Date("2026-12-11T00:00:00Z"))).toBeNull();
  });
});
