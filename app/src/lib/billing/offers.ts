import type { Interval } from "./plans";

export type Offer = {
  code: string;
  trialDays: number;
  /** Last instant a signup can still claim the offer. */
  signupDeadline: Date;
  /** Stripe coupon applied at checkout, per billing interval (created in Stripe by hand). */
  couponIds: Record<Interval, string>;
  discountPercent: number;
  discountMonths: number;
};

export const OFFERS: Record<string, Offer> = {
  "cold-2026-11": {
    code: "cold-2026-11",
    trialDays: 30,
    signupDeadline: new Date("2026-11-30T22:59:59Z"),
    // Stripe counts a repeating coupon's months from subscription creation, trial included.
    // Monthly: 13 months covers 12 invoices after a ~30-day trial. Yearly: 12 months covers
    // the first yearly invoice only, so the renewal a year later is billed at full price.
    couponIds: { month: "cold-2026-11-30off", year: "cold-2026-11-30off-year" },
    discountPercent: 30,
    discountMonths: 12,
  },
};

export function offerFor(code: string | null | undefined): Offer | null {
  // Own-property check so "toString" and friends are not offers
  if (!code || !Object.prototype.hasOwnProperty.call(OFFERS, code)) return null;
  return OFFERS[code];
}

/**
 * Stripe Checkout rejects a subscription trial_end less than 48 hours away. One hour of margin
 * because the customer and price lookups run between this check and sessions.create.
 */
export const MIN_TRIAL_END_MS = 49 * 60 * 60 * 1000;

type OfferOrg = { offerCode: string | null; trialEndsAt: Date | null };

/** The workspace's offer while its trial still runs, or null. */
function liveOffer(org: OfferOrg, now: Date): { offer: Offer; trialEndsAt: Date } | null {
  const offer = offerFor(org.offerCode);
  if (!offer || !org.trialEndsAt || now >= org.trialEndsAt) return null;
  return { offer, trialEndsAt: org.trialEndsAt };
}

/** What checkout applies for a workspace still on its offer: the coupon for this interval, and the trial end to carry over. */
export function checkoutOffer(org: OfferOrg, now: Date, interval: Interval): { couponId: string; trialEnd: number | null } | null {
  const live = liveOffer(org, now);
  if (!live) return null;
  const farEnough = live.trialEndsAt.getTime() - now.getTime() >= MIN_TRIAL_END_MS;
  return { couponId: live.offer.couponIds[interval], trialEnd: farEnough ? Math.floor(live.trialEndsAt.getTime() / 1000) : null };
}

/** The date the discount can no longer be taken (the end of the trial), or null when there is none to take. */
export function offerEndsAt(org: OfferOrg, now: Date): Date | null {
  return liveOffer(org, now)?.trialEndsAt ?? null;
}
