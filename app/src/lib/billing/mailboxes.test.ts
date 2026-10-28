import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() };
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: (...a: unknown[]) => db.findUnique(...a),
      findMany: (...a: unknown[]) => db.findMany(...a),
      update: (...a: unknown[]) => db.update(...a),
    },
    mailbox: { count: (...a: unknown[]) => db.count(...a) },
  },
}));

const plan = vi.fn();
vi.mock("./workspace-plan", async () => {
  class PlanLimitError extends Error {
    constructor(readonly reason: string) {
      super(`plan_limit:${reason}`);
    }
  }
  return { getWorkspacePlan: (...a: unknown[]) => plan(...a), PlanLimitError };
});

const stripe = {
  subscriptions: { retrieve: vi.fn() },
  subscriptionItems: { create: vi.fn(), update: vi.fn(), del: vi.fn() },
  prices: { list: vi.fn() },
};
let stripeOn: typeof stripe | null = stripe;
vi.mock("./stripe", async (orig) => {
  const actual = await orig<typeof import("./stripe")>();
  return { ...actual, getStripe: () => stripeOn };
});

const { assertCanConnectMailbox, canUseMailboxes, countBillableMailboxes, reconcileMailboxes, syncMailboxQuantity } =
  await import("./mailboxes");
const { PLANS } = await import("./plans");
const { PlanLimitError } = await import("./workspace-plan");

const PLAN_ITEM = (key: string) => ({ id: "si_plan", quantity: 1, price: { lookup_key: key } });
const MAILBOX_ITEM = (key: string, quantity: number) => ({ id: "si_mb", quantity, price: { lookup_key: key } });
const sub = (...items: unknown[]) => ({ id: "sub_1", status: "active", cancel_at_period_end: false, items: { data: items } });
const PROTECTED = { proration_behavior: "always_invoice" };

function org(over: Record<string, unknown> = {}) {
  db.findUnique.mockResolvedValue({
    plan: "solo",
    planStatus: "active",
    stripeSubscriptionId: "sub_1",
    billingInterval: "month",
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stripeOn = stripe;
  org();
  db.count.mockResolvedValue(1);
  db.update.mockResolvedValue({});
  stripe.prices.list.mockResolvedValue({ data: [{ id: "price_mb" }] });
  stripe.subscriptionItems.create.mockResolvedValue({});
  stripe.subscriptionItems.update.mockResolvedValue({});
  stripe.subscriptionItems.del.mockResolvedValue({});
});

describe("countBillableMailboxes", () => {
  it("counts everything but disconnected mailboxes", async () => {
    db.count.mockResolvedValue(4);
    expect(await countBillableMailboxes("org1")).toBe(4);
    expect(db.count.mock.calls[0][0].where).toEqual({ organizationId: "org1", status: { not: "DISCONNECTED" } });
  });
});

describe("syncMailboxQuantity", () => {
  it("adds the item at the monthly price when the first mailbox is connected", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(sub(PLAN_ITEM("clozer_solo_monthly")));
    expect(await syncMailboxQuantity("org1", { stripe })).toBe("added");
    expect(stripe.prices.list.mock.calls[0][0].lookup_keys).toEqual(["clozer_mailbox_monthly"]);
    expect(stripe.subscriptionItems.create).toHaveBeenCalledWith({
      subscription: "sub_1",
      price: "price_mb",
      quantity: 1,
      ...PROTECTED,
    });
    expect(db.update.mock.calls[0][0].data).toEqual({ mailboxQuantity: 1 });
  });

  it("updates the quantity of an existing item", async () => {
    db.count.mockResolvedValue(3);
    stripe.subscriptions.retrieve.mockResolvedValue(sub(PLAN_ITEM("clozer_solo_monthly"), MAILBOX_ITEM("clozer_mailbox_monthly", 2)));
    expect(await syncMailboxQuantity("org1", { stripe })).toBe("updated");
    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith("si_mb", { quantity: 3, ...PROTECTED });
    expect(db.update.mock.calls[0][0].data).toEqual({ mailboxQuantity: 3 });
  });

  it("removes the item when no mailbox is left", async () => {
    db.count.mockResolvedValue(0);
    stripe.subscriptions.retrieve.mockResolvedValue(sub(PLAN_ITEM("clozer_solo_monthly"), MAILBOX_ITEM("clozer_mailbox_monthly", 1)));
    expect(await syncMailboxQuantity("org1", { stripe })).toBe("removed");
    expect(stripe.subscriptionItems.del).toHaveBeenCalledWith("si_mb", PROTECTED);
    expect(db.update.mock.calls[0][0].data).toEqual({ mailboxQuantity: null });
  });

  it("does nothing when the item already matches", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(sub(PLAN_ITEM("clozer_solo_monthly"), MAILBOX_ITEM("clozer_mailbox_monthly", 1)));
    expect(await syncMailboxQuantity("org1", { stripe })).toBe("unchanged");
    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does nothing with no mailbox and no item", async () => {
    db.count.mockResolvedValue(0);
    stripe.subscriptions.retrieve.mockResolvedValue(sub(PLAN_ITEM("clozer_solo_monthly")));
    expect(await syncMailboxQuantity("org1", { stripe })).toBe("unchanged");
  });

  it("moves the item to the yearly price when the plan switched interval", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(sub(PLAN_ITEM("clozer_solo_yearly"), MAILBOX_ITEM("clozer_mailbox_monthly", 1)));
    expect(await syncMailboxQuantity("org1", { stripe })).toBe("updated");
    expect(stripe.prices.list.mock.calls[0][0].lookup_keys).toEqual(["clozer_mailbox_yearly"]);
    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith("si_mb", { price: "price_mb", quantity: 1, ...PROTECTED });
  });

  it.each([
    ["a trial", { planStatus: "trialing", stripeSubscriptionId: null }],
    ["a comped workspace", { planStatus: "comped", stripeSubscriptionId: null }],
    ["an enterprise plan", { plan: "enterprise" }],
    ["a cancelled subscription", { planStatus: "canceled" }],
    ["no subscription", { stripeSubscriptionId: null }],
  ])("skips %s", async (_name, over) => {
    org(over);
    expect(await syncMailboxQuantity("org1", { stripe })).toBe("skipped");
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("skips when billing is off", async () => {
    stripeOn = null;
    expect(await syncMailboxQuantity("org1")).toBe("skipped");
    expect(db.findUnique).not.toHaveBeenCalled();
  });
});

describe("assertCanConnectMailbox", () => {
  it("refuses a Free workspace", async () => {
    plan.mockResolvedValue({ limits: PLANS.free });
    expect(await canUseMailboxes("org1")).toBe(false);
    await expect(assertCanConnectMailbox("org1")).rejects.toMatchObject({ reason: "mailbox" });
    await expect(assertCanConnectMailbox("org1")).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("lets Solo through", async () => {
    plan.mockResolvedValue({ limits: PLANS.solo });
    await expect(assertCanConnectMailbox("org1")).resolves.toBeUndefined();
  });
});

describe("reconcileMailboxes", () => {
  it("only syncs the workspaces whose item drifted", async () => {
    const ok = { id: "ok", plan: "solo", mailboxQuantity: 1, _count: { mailboxes: 1 + (PLANS.solo.includedMailboxes ?? 0) } };
    const drifted = { id: "drift", plan: "solo", mailboxQuantity: null, _count: { mailboxes: 2 + (PLANS.solo.includedMailboxes ?? 0) } };
    db.findMany.mockResolvedValue([ok, drifted]);
    db.findUnique.mockResolvedValue(null); // the sync itself is skipped: only who it is called for matters
    expect(await reconcileMailboxes()).toBe(1);
    expect(db.findUnique.mock.calls.map((c) => c[0].where.id)).toEqual(["drift"]);
  });

  it("keeps going when one sync fails", async () => {
    const a = { id: "a", plan: "team", mailboxQuantity: null, _count: { mailboxes: 5 } };
    const b = { id: "b", plan: "team", mailboxQuantity: null, _count: { mailboxes: 5 } };
    db.findMany.mockResolvedValue([a, b]);
    db.findUnique.mockRejectedValueOnce(new Error("db")).mockResolvedValue(null);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reconcileMailboxes()).toBe(2);
    expect(db.findUnique).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
