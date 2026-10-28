import { HOUR_MS } from "@/lib/closing/constants";

/** Graph allows 10 080 minutes for mail; a bit under 3 days keeps a missed renewal tick harmless. */
export const SUBSCRIPTION_TTL_MIN = 4230;
export const RENEW_BEFORE_MS = 36 * HOUR_MS;

/** No expiry on record counts as needing one (created or recreated by the same renewal tick). */
export function subscriptionNeedsRenewal(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - now.getTime() <= RENEW_BEFORE_MS;
}

export function subscriptionExpiry(now: Date): Date {
  return new Date(now.getTime() + SUBSCRIPTION_TTL_MIN * 60_000);
}
