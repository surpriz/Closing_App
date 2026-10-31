// Amounts mirror app/src/lib/billing/plans.ts (MONTHLY_PRICE_CENTS, PLANS, TEAM_MIN_SEATS, TRIAL_DAYS),
// copied by hand: the landing doesn't import from the app. Stripe holds the real prices; change them
// there first, then in plans.ts, then here. Copy lives in messages/<locale>.json under "pricing"
// (the plan cards list pricing.plans.<plan>.features in file order).

export const PLAN_KEYS = ["free", "solo", "team", "enterprise"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type PaidPlanKey = "solo" | "team";
export type Interval = "month" | "year";

/** Euros excl. VAT, per month (per member for Team). Yearly is billed at once: 12 × the yearly figure. */
export const MONTHLY_PRICE: Record<PaidPlanKey, Record<Interval, number>> = {
  solo: { month: 19, year: 15 },
  team: { month: 39, year: 32 },
};

export const TEAM_MIN_SEATS = 2;
export const TRIAL_DAYS = 14;

/**
 * Extra connected mailboxes for campaigns, euros excl. VAT per mailbox per month. Solo includes one, Team one per
 * member, Enterprise all of them (mirrors includedMailboxes / mailboxesPerSeat in the app's plans.ts).
 */
export const MAILBOX_MONTHLY_PRICE: Record<Interval, number> = { month: 9, year: 7 };

export function euros(locale: string, amount: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

/**
 * true / false: included or not. A number: a monthly cap, or a count for video pitches. null: unlimited.
 * "oneIncluded" / "onePerSeat": one mailbox included (per member), the rest paid per mailbox.
 */
type Cell = boolean | number | null | "oneIncluded" | "onePerSeat";
type Row = { key: string; monthly?: boolean; cells: Record<PlanKey, Cell> };

const all: Record<PlanKey, Cell> = { free: true, solo: true, team: true, enterprise: true };
const paid: Record<PlanKey, Cell> = { free: false, solo: true, team: true, enterprise: true };
const team: Record<PlanKey, Cell> = { free: false, solo: false, team: true, enterprise: true };
const capped = (free: number): Record<PlanKey, Cell> => ({ free, solo: null, team: null, enterprise: null });

/** The comparison table. Keys are pricing.table.rows.<key>. */
export const COMPARISON = [
  { key: "links", monthly: true, cells: capped(5) },
  { key: "tracking", cells: all },
  { key: "followUps", monthly: true, cells: capped(10) },
  { key: "autopilot", cells: paid },
  { key: "extension", cells: all },
  { key: "booking", cells: all },
  { key: "assistant", cells: paid },
  { key: "translation", cells: paid },
  { key: "voice", cells: paid },
  { key: "video", cells: capped(1) },
  { key: "noBadge", cells: paid },
  { key: "teamView", cells: team },
  { key: "invites", cells: team },
  { key: "slack", cells: team },
  { key: "campaigns", cells: paid },
  { key: "mailbox", cells: { free: false, solo: "oneIncluded", team: "onePerSeat", enterprise: null } },
] as const satisfies readonly Row[];
