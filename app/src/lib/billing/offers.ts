export type Offer = {
  code: string;
  trialDays: number;
  /** Last instant a signup can still claim the offer. */
  signupDeadline: Date;
  /** Stripe coupon applied at checkout (created in Stripe by hand). */
  couponId: string;
  discountPercent: number;
  discountMonths: number;
};

export const OFFERS: Record<string, Offer> = {
  "cold-2026-11": {
    code: "cold-2026-11",
    trialDays: 30,
    signupDeadline: new Date("2026-11-30T22:59:59Z"),
    couponId: "cold-2026-11-30off",
    discountPercent: 30,
    discountMonths: 12,
  },
};

export function offerFor(code: string | null | undefined): Offer | null {
  // Own-property check so "toString" and friends are not offers
  if (!code || !Object.prototype.hasOwnProperty.call(OFFERS, code)) return null;
  return OFFERS[code];
}
