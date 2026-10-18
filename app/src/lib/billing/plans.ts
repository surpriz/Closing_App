/**
 * Plans and what each one allows. Pure: the plan a workspace is on right now
 * comes from its billing columns, the date and two settings passed in, so
 * every rule here is unit-tested. Database reads live in workspace-plan.ts.
 *
 * Amounts here are for display only: Stripe holds the real prices (found by
 * lookup key). The landing mirrors them by hand in landing/src/content/pricing.ts.
 */

export const PLAN_IDS = ["free", "solo", "team", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlanId = "solo" | "team";
export type Interval = "month" | "year";

export type PlanLimits = {
  rank: number;
  /** Seller links created per calendar month (UTC), drafts included. Null: unlimited. */
  linksPerMonth: number | null;
  /** Follow-ups written by the AI per calendar month; past it, the template takes over. */
  aiFollowupsPerMonth: number | null;
  autopilot: boolean;
  /** Prospect chat, translation and voice comments, on links created on this plan. */
  prospectChat: boolean;
  translation: boolean;
  voiceComments: boolean;
  /** Video pitches kept (not archived). */
  videoPitches: number | null;
  /** "via Clozer" under the viewer. */
  branding: boolean;
  teamView: boolean;
  invites: boolean;
  slack: boolean;
  webhooks: boolean;
};

const SOLO: PlanLimits = {
  rank: 1,
  linksPerMonth: null,
  aiFollowupsPerMonth: null,
  autopilot: true,
  prospectChat: true,
  translation: true,
  voiceComments: true,
  videoPitches: null,
  branding: false,
  teamView: false,
  invites: false,
  slack: false,
  webhooks: false,
};

const TEAM: PlanLimits = { ...SOLO, rank: 2, teamView: true, invites: true, slack: true, webhooks: true };

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    rank: 0,
    linksPerMonth: 5,
    aiFollowupsPerMonth: 10,
    autopilot: false,
    prospectChat: false,
    translation: false,
    voiceComments: false,
    videoPitches: 1,
    branding: true,
    teamView: false,
    invites: false,
    slack: false,
    webhooks: false,
  },
  solo: SOLO,
  team: TEAM,
  enterprise: { ...TEAM, rank: 3 },
};

/** Euro cents, excl. VAT, per month (per seat for Team). Yearly is billed at once: 12 × this. */
export const MONTHLY_PRICE_CENTS: Record<PaidPlanId, Record<Interval, number>> = {
  solo: { month: 1900, year: 1500 },
  team: { month: 3900, year: 3200 },
};

/** Where every upgrade prompt leads: the billing section of the settings. */
export const BILLING_HREF = "/settings#facturation";

export const TEAM_MIN_SEATS = 2;
export const TRIAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export const LOOKUP_KEYS: Record<PaidPlanId, Record<Interval, string>> = {
  solo: { month: "clozer_solo_monthly", year: "clozer_solo_yearly" },
  team: { month: "clozer_team_monthly", year: "clozer_team_yearly" },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return value === "solo" || value === "team";
}

export function lookupKeyFor(plan: PaidPlanId, interval: Interval) {
  return LOOKUP_KEYS[plan][interval];
}

export function planFromLookupKey(key: string | null | undefined): { plan: PaidPlanId; interval: Interval } | null {
  for (const plan of ["solo", "team"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (LOOKUP_KEYS[plan][interval] === key) return { plan, interval };
    }
  }
  return null;
}

/** Stripe statuses that keep the paid plan: past_due too, while Stripe retries the card. */
export const PAID_STATUSES = ["active", "trialing", "past_due"] as const;
export const COMPED_STATUS = "comped";

export type BillingFacts = {
  plan: string;
  planStatus: string | null;
  trialEndsAt: Date | null;
  betaGrace: boolean;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingOptions = {
  /** Beta workspaces keep Team until then. Null: not announced yet, the grace goes on. */
  betaGraceUntil: Date | null;
  /** No Stripe key (dev, previews): nothing is locked. */
  billingEnabled: boolean;
};

export type PlanSource = "subscription" | "comped" | "trial" | "beta" | "free" | "unbilled";

export type EffectivePlan = {
  plan: PlanId;
  limits: PlanLimits;
  source: PlanSource;
  /** When this source stops: trial end, beta end, or the date a cancelled subscription runs out. */
  endsAt: Date | null;
  /** The card failed, Stripe is retrying: access kept. */
  paymentIssue: boolean;
  /** The plan paid for, if any, even when a trial or the beta ranks higher. */
  subscribed: PlanId | null;
};

function isPaidStatus(status: string | null): boolean {
  return !!status && (PAID_STATUSES as readonly string[]).includes(status);
}

/** The plan a workspace gets now: the best of what it pays for, what it was granted, its trial and the beta. */
export function effectivePlan(org: BillingFacts, now: Date, options: BillingOptions): EffectivePlan {
  const paid = isPaidStatus(org.planStatus) && isPlanId(org.plan) ? org.plan : null;
  const comped = org.planStatus === COMPED_STATUS && isPlanId(org.plan) ? org.plan : null;
  const subscribed = paid ?? comped;
  const paymentIssue = org.planStatus === "past_due";

  if (!options.billingEnabled) {
    return { plan: "team", limits: PLANS.team, source: "unbilled", endsAt: null, paymentIssue: false, subscribed };
  }

  const candidates: { plan: PlanId; source: PlanSource; endsAt: Date | null }[] = [];
  if (paid) candidates.push({ plan: paid, source: "subscription", endsAt: org.cancelAtPeriodEnd ? org.currentPeriodEnd : null });
  if (comped) candidates.push({ plan: comped, source: "comped", endsAt: null });
  if (org.trialEndsAt && org.trialEndsAt > now) candidates.push({ plan: "team", source: "trial", endsAt: org.trialEndsAt });
  if (org.betaGrace && (!options.betaGraceUntil || now < options.betaGraceUntil)) {
    candidates.push({ plan: "team", source: "beta", endsAt: options.betaGraceUntil });
  }

  // Highest plan wins; on a tie, what they pay for beats what runs out
  const best = candidates.reduce<(typeof candidates)[number] | null>(
    (top, candidate) => (!top || PLANS[candidate.plan].rank > PLANS[top.plan].rank ? candidate : top),
    null,
  );
  if (!best) return { plan: "free", limits: PLANS.free, source: "free", endsAt: null, paymentIssue, subscribed };
  return { plan: best.plan, limits: PLANS[best.plan], source: best.source, endsAt: best.endsAt, paymentIssue, subscribed };
}

/** Seats billed for Team: every member, never under the minimum. */
export function seatQuantity(memberCount: number) {
  return Math.max(TEAM_MIN_SEATS, memberCount);
}

export function trialEndsAtFor(createdAt: Date) {
  return new Date(createdAt.getTime() + TRIAL_DAYS * DAY_MS);
}

export function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type Quota = { allowed: boolean; used: number; max: number | null };

/** One more allowed under a monthly or standing cap. */
export function quota(max: number | null, used: number): Quota {
  return { allowed: max === null || used < max, used, max };
}

export type BannerKind = "trial" | "beta" | "payment" | "canceling";

/** Days before an end date when the dashboard starts saying so. */
export const BANNER_DAYS = 7;

/** What the dashboard banner says, if anything: a payment issue first, then an end coming up. */
export function bannerFor(plan: EffectivePlan, now: Date): { kind: BannerKind; daysLeft: number | null } | null {
  if (plan.paymentIssue) return { kind: "payment", daysLeft: null };
  if (!plan.endsAt) return null;
  const daysLeft = Math.max(0, Math.ceil((plan.endsAt.getTime() - now.getTime()) / DAY_MS));
  if (daysLeft > BANNER_DAYS) return null;
  const kind: BannerKind | null =
    plan.source === "trial" ? "trial" : plan.source === "beta" ? "beta" : plan.source === "subscription" ? "canceling" : null;
  return kind ? { kind, daysLeft } : null;
}

/** The few Stripe subscription fields read, so tests need no SDK. */
export type SubscriptionLike = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  items: {
    data: { quantity?: number | null; current_period_end?: number | null; price: { lookup_key?: string | null; recurring?: { interval?: string } | null } }[];
  };
};

const ENDED_STATUSES = ["canceled", "incomplete_expired", "unpaid"];

/** The Organization columns a Stripe subscription maps to. Since API "basil" the period sits on the item. */
export function subscriptionFields(sub: SubscriptionLike) {
  const item = sub.items.data[0];
  const priced = planFromLookupKey(item?.price.lookup_key);
  const ended = ENDED_STATUSES.includes(sub.status);
  const interval = priced?.interval ?? (item?.price.recurring?.interval === "year" ? "year" : "month");
  return {
    plan: ended || !priced ? "free" : priced.plan,
    planStatus: sub.status,
    stripeSubscriptionId: sub.id,
    billingInterval: interval,
    seats: item?.quantity ?? null,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: !ended && sub.cancel_at_period_end,
  };
}
