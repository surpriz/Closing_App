import { describe, expect, it } from "vitest";

import { offerFor } from "./offers";

describe("offerFor", () => {
  it("knows the cold email offer", () => {
    const offer = offerFor("cold-2026-11")!;
    expect(offer.trialDays).toBe(30);
    expect(offer.signupDeadline.toISOString()).toBe("2026-11-30T22:59:59.000Z");
    expect(offer.couponId).toBe("cold-2026-11-30off");
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
