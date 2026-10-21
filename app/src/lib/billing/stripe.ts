import Stripe from "stripe";

import { getEnv } from "@/lib/env";

import { lookupKeyFor, type Interval, type PaidPlanId } from "./plans";

let client: Stripe | null = null;

/** Null when billing is off (no key): callers degrade, nothing is locked. */
export function getStripe(): Stripe | null {
  const key = getEnv().STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "Clozer" } });
  return client;
}

const PRICE_TTL_MS = 10 * 60 * 1000;
const prices = new Map<string, { id: string; at: number }>();

/** The Stripe price for a plan, found by lookup key so a new amount needs no deploy (scripts/stripe-setup.mjs). */
export async function resolvePrice(stripe: Stripe, plan: PaidPlanId, interval: Interval) {
  const key = lookupKeyFor(plan, interval);
  const cached = prices.get(key);
  if (cached && Date.now() - cached.at < PRICE_TTL_MS) return cached.id;
  const { data } = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (!data[0]) throw new Error(`[billing] no active Stripe price for ${key}: run scripts/stripe-setup.mjs`);
  prices.set(key, { id: data[0].id, at: Date.now() });
  return data[0].id;
}

let portals: { solo?: string; team?: string; at: number } | null = null;

/** The portal for this plan (scripts/stripe-setup.mjs): Team's offers no way down to Solo. Undefined: Stripe's default. */
export async function resolvePortalConfiguration(stripe: Stripe, plan: string) {
  if (!portals || Date.now() - portals.at >= PRICE_TTL_MS) {
    const { data } = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    const byKind = (kind: string) => data.find((configuration) => configuration.metadata?.clozer_portal === kind)?.id;
    portals = { solo: byKind("solo"), team: byKind("team"), at: Date.now() };
  }
  return plan === "solo" ? portals.solo : portals.team;
}
