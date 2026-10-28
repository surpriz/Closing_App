import { describe, expect, it } from "vitest";

import {
  PLANS,
  bannerFor,
  billableMailboxes,
  effectivePlan,
  isMailboxLookupKey,
  lookupKeyFor,
  mailboxIntervalFromLookupKey,
  mailboxLookupKeyFor,
  planItemOf,
  planFromLookupKey,
  quota,
  seatQuantity,
  startOfUtcMonth,
  subscriptionFields,
  trialEndsAtFor,
  type BillingFacts,
} from "./plans";

const NOW = new Date("2026-11-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);

const FREE: BillingFacts = {
  plan: "free",
  planStatus: null,
  trialEndsAt: null,
  betaGrace: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};
const BILLED = { betaGraceUntil: null, billingEnabled: true };

describe("effectivePlan", () => {
  it("gives Team during the trial, Free after it", () => {
    expect(effectivePlan({ ...FREE, trialEndsAt: later(3) }, NOW, BILLED)).toMatchObject({ plan: "team", source: "trial" });
    expect(effectivePlan({ ...FREE, trialEndsAt: later(-1) }, NOW, BILLED)).toMatchObject({ plan: "free", source: "free" });
  });

  it("keeps beta workspaces on Team until the announced date", () => {
    const beta = { ...FREE, betaGrace: true };
    expect(effectivePlan(beta, NOW, BILLED)).toMatchObject({ plan: "team", source: "beta", endsAt: null });
    expect(effectivePlan(beta, NOW, { ...BILLED, betaGraceUntil: later(5) })).toMatchObject({ plan: "team", source: "beta" });
    expect(effectivePlan(beta, NOW, { ...BILLED, betaGraceUntil: later(-1) }).plan).toBe("free");
  });

  it("keeps the trial's Team when Solo is bought during it", () => {
    const plan = effectivePlan({ ...FREE, plan: "solo", planStatus: "active", trialEndsAt: later(2) }, NOW, BILLED);
    expect(plan).toMatchObject({ plan: "team", source: "trial", subscribed: "solo" });
  });

  it("prefers the subscription over a trial of the same plan", () => {
    const plan = effectivePlan({ ...FREE, plan: "team", planStatus: "active", trialEndsAt: later(2) }, NOW, BILLED);
    expect(plan.source).toBe("subscription");
  });

  it("keeps access while a payment is retried", () => {
    expect(effectivePlan({ ...FREE, plan: "solo", planStatus: "past_due" }, NOW, BILLED)).toMatchObject({
      plan: "solo",
      paymentIssue: true,
    });
  });

  it("drops a cancelled subscription to Free", () => {
    expect(effectivePlan({ ...FREE, plan: "free", planStatus: "canceled" }, NOW, BILLED).plan).toBe("free");
    expect(effectivePlan({ ...FREE, plan: "team", planStatus: "incomplete" }, NOW, BILLED).plan).toBe("free");
  });

  it("says when a cancelled-at-period-end subscription runs out", () => {
    const end = later(4);
    const plan = effectivePlan({ ...FREE, plan: "solo", planStatus: "active", cancelAtPeriodEnd: true, currentPeriodEnd: end }, NOW, BILLED);
    expect(plan.endsAt).toEqual(end);
  });

  it("honours a plan granted by the platform admin", () => {
    expect(effectivePlan({ ...FREE, plan: "enterprise", planStatus: "comped" }, NOW, BILLED)).toMatchObject({
      plan: "enterprise",
      source: "comped",
    });
  });

  it("locks nothing when billing is not configured", () => {
    expect(effectivePlan(FREE, NOW, { betaGraceUntil: null, billingEnabled: false })).toMatchObject({
      plan: "team",
      source: "unbilled",
    });
  });
});

describe("helpers", () => {
  it("bills at least two seats for Team", () => {
    expect([0, 1, 2, 5].map(seatQuantity)).toEqual([2, 2, 2, 5]);
  });

  it("maps lookup keys both ways", () => {
    expect(planFromLookupKey(lookupKeyFor("team", "year"))).toEqual({ plan: "team", interval: "year" });
    expect(planFromLookupKey(lookupKeyFor("solo", "month"))).toEqual({ plan: "solo", interval: "month" });
    expect(planFromLookupKey("other")).toBeNull();
    expect(planFromLookupKey(null)).toBeNull();
  });

  it("allows up to the cap, always when unlimited", () => {
    expect(quota(5, 4).allowed).toBe(true);
    expect(quota(5, 5).allowed).toBe(false);
    expect(quota(5, 6).allowed).toBe(false);
    expect(quota(null, 1000).allowed).toBe(true);
  });

  it("starts the month at midnight UTC on the 1st", () => {
    expect(startOfUtcMonth(new Date("2026-11-30T23:59:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("ends the trial 14 days after creation", () => {
    expect(trialEndsAtFor(NOW)).toEqual(later(14));
  });
});

describe("bannerFor", () => {
  it("warns in the last week of a trial only", () => {
    expect(bannerFor(effectivePlan({ ...FREE, trialEndsAt: later(10) }, NOW, BILLED), NOW)).toBeNull();
    expect(bannerFor(effectivePlan({ ...FREE, trialEndsAt: later(3) }, NOW, BILLED), NOW)).toEqual({ kind: "trial", daysLeft: 3 });
  });

  it("puts a payment issue first", () => {
    expect(bannerFor(effectivePlan({ ...FREE, plan: "solo", planStatus: "past_due" }, NOW, BILLED), NOW)?.kind).toBe("payment");
  });

  it("says nothing for a beta with no date yet", () => {
    expect(bannerFor(effectivePlan({ ...FREE, betaGrace: true }, NOW, BILLED), NOW)).toBeNull();
  });
});

describe("subscriptionFields", () => {
  const item = (lookup: string, quantity = 1) => ({
    quantity,
    current_period_end: 1_800_000_000,
    price: { lookup_key: lookup, recurring: { interval: "year" } },
  });

  it("maps an active yearly Team subscription", () => {
    expect(
      subscriptionFields({ id: "sub_1", status: "active", cancel_at_period_end: false, items: { data: [item("clozer_team_yearly", 3)] } }, "free"),
    ).toEqual({
      plan: "team",
      planStatus: "active",
      stripeSubscriptionId: "sub_1",
      billingInterval: "year",
      seats: 3,
      currentPeriodEnd: new Date(1_800_000_000_000),
      cancelAtPeriodEnd: false,
      mailboxQuantity: null,
    });
  });

  it("falls back to Free once the subscription is over", () => {
    const fields = subscriptionFields({ id: "sub_1", status: "canceled", cancel_at_period_end: true, items: { data: [item("clozer_solo_monthly")] } }, "solo");
    expect(fields).toMatchObject({ plan: "free", planStatus: "canceled", cancelAtPeriodEnd: false });
  });

  it("keeps a payer's plan when their price lost its lookup key", () => {
    const sub = { id: "sub_1", status: "active", cancel_at_period_end: false, items: { data: [item("")] } };
    expect(subscriptionFields(sub, "team").plan).toBe("team");
    expect(subscriptionFields({ ...sub, metadata: { plan: "solo" } }, "free").plan).toBe("solo");
  });

  it("grants nothing for an unknown price on a workspace that never paid", () => {
    expect(subscriptionFields({ id: "sub_1", status: "active", cancel_at_period_end: false, items: { data: [item("unknown")] } }, "free").plan).toBe("free");
  });
});

describe("mailbox add-on", () => {
  const item = (lookup: string, quantity: number, id: string) => ({
    id,
    quantity,
    current_period_end: 1_800_000_000,
    price: { lookup_key: lookup, recurring: { interval: "month" } },
  });
  const sub = (status: string) => ({
    id: "sub_1",
    status,
    cancel_at_period_end: false,
    items: { data: [item("clozer_mailbox_monthly", 2, "si_box"), item("clozer_team_monthly", 4, "si_plan")] },
  });

  it("reads the plan from its own item when the mailbox item comes first", () => {
    expect(subscriptionFields(sub("active"), "free")).toMatchObject({
      plan: "team",
      billingInterval: "month",
      seats: 4,
      mailboxQuantity: 2,
    });
    expect(planItemOf(sub("active"))?.id).toBe("si_plan");
  });

  it("drops the mailbox quantity once the subscription is over", () => {
    expect(subscriptionFields(sub("canceled"), "team").mailboxQuantity).toBeNull();
  });

  it("falls back on the first non-mailbox item, then on the only item", () => {
    const unknown = { items: { data: [item("clozer_mailbox_monthly", 1, "a"), item("legacy", 3, "b")] } };
    expect(planItemOf(unknown)?.id).toBe("b");
    expect(planItemOf({ items: { data: [item("", 1, "only")] } })?.id).toBe("only");
    expect(planItemOf({ items: { data: [] } })).toBeUndefined();
  });

  it("knows the mailbox lookup keys", () => {
    expect(mailboxLookupKeyFor("year")).toBe("clozer_mailbox_yearly");
    expect(isMailboxLookupKey("clozer_mailbox_monthly")).toBe(true);
    expect(isMailboxLookupKey("clozer_team_monthly")).toBe(false);
    expect(isMailboxLookupKey(null)).toBe(false);
    expect(mailboxIntervalFromLookupKey("clozer_mailbox_yearly")).toBe("year");
    expect(mailboxIntervalFromLookupKey("nope")).toBeNull();
  });

  it("bills the mailboxes over what the plan includes", () => {
    expect(billableMailboxes(3, { includedMailboxes: 0 })).toBe(3);
    expect(billableMailboxes(3, { includedMailboxes: null })).toBe(0);
    expect(billableMailboxes(1, { includedMailboxes: 2 })).toBe(0);
    expect(billableMailboxes(5, { includedMailboxes: 2 })).toBe(3);
  });

  it("sells the add-on on paid plans only", () => {
    expect(PLANS.free).toMatchObject({ mailboxAddon: false, includedMailboxes: 0 });
    expect(PLANS.solo).toMatchObject({ mailboxAddon: true, includedMailboxes: 0 });
    expect(PLANS.team).toMatchObject({ mailboxAddon: true, includedMailboxes: 0 });
    expect(PLANS.enterprise).toMatchObject({ mailboxAddon: true, includedMailboxes: null });
  });
});
