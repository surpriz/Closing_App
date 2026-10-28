import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() };
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique: (...a: unknown[]) => db.findUnique(...a), update: (...a: unknown[]) => db.update(...a) },
    member: { findFirst: (...a: unknown[]) => db.findFirst(...a) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ captureProductEvent: vi.fn() }));
vi.mock("@/lib/closing/followups/queue", () => ({ isUniqueViolation: () => false }));
vi.mock("./seats", () => ({ syncSeats: vi.fn() }));
vi.mock("./send-emails", () => ({ sendPaymentFailedEmail: vi.fn() }));
const syncMailboxes = vi.fn();
vi.mock("./mailboxes", () => ({ syncMailboxQuantity: (...a: unknown[]) => syncMailboxes(...a) }));

const { syncSubscription } = await import("./webhook");

const subscription = (status: string) => ({
  id: "sub_1",
  status,
  customer: "cus_1",
  cancel_at_period_end: false,
  metadata: { organizationId: "org1" },
  items: { data: [{ id: "si_plan", quantity: 1, price: { lookup_key: "clozer_solo_monthly" } }] },
});
const stripeWith = (status: string) => ({ subscriptions: { retrieve: async () => subscription(status) } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  db.findUnique.mockResolvedValue({ id: "org1", plan: "solo", planStatus: "active", stripeSubscriptionId: "sub_1", _count: { members: 1 } });
  db.update.mockResolvedValue({});
  db.findFirst.mockResolvedValue(null);
  syncMailboxes.mockResolvedValue("unchanged");
});

describe("syncSubscription and the mailbox item", () => {
  it("syncs the mailbox quantity for a paid status", async () => {
    await syncSubscription(stripeWith("active"), "sub_1");
    expect(syncMailboxes).toHaveBeenCalledWith("org1");
  });

  it("leaves the item alone when the subscription is not paid", async () => {
    await syncSubscription(stripeWith("canceled"), "sub_1");
    expect(syncMailboxes).not.toHaveBeenCalled();
  });

  it("is not failed by a sync that rejects", async () => {
    syncMailboxes.mockRejectedValue(new Error("stripe down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(syncSubscription(stripeWith("active"), "sub_1")).resolves.toBe("org1");
    spy.mockRestore();
  });
});
