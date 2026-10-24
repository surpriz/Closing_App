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

/** Stripe Checkout rejects a subscription trial_end less than 48 hours away. */
export const MIN_TRIAL_END_MS = 48 * 60 * 60 * 1000;

type OfferOrg = { offerCode: string | null; trialEndsAt: Date | null };

/** What checkout applies for a workspace still on its offer: the coupon, and the trial end to carry over. */
export function checkoutOffer(org: OfferOrg, now: Date): { couponId: string; trialEnd: number | null } | null {
  const offer = offerFor(org.offerCode);
  if (!offer || !org.trialEndsAt || now >= org.trialEndsAt) return null;
  const farEnough = org.trialEndsAt.getTime() - now.getTime() >= MIN_TRIAL_END_MS;
  return { couponId: offer.couponId, trialEnd: farEnough ? Math.floor(org.trialEndsAt.getTime() / 1000) : null };
}

/** The date the discount can no longer be taken (the end of the trial), or null when there is none to take. */
export function offerEndsAt(org: OfferOrg, now: Date): Date | null {
  return checkoutOffer(org, now) ? org.trialEndsAt : null;
}
