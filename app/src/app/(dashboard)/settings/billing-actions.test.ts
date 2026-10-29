import { beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
const retrieve = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "fr",
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/app-origin", () => ({ getAppOrigin: async () => "https://app.test" }));
vi.mock("@/lib/billing/offers", () => ({ checkoutOffer: vi.fn() }));
vi.mock("@/lib/billing/webhook", () => ({ syncSubscription: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { member: { count: async () => 3 } } }));
vi.mock("@/lib/session", () => ({
  requireManager: async () => ({
    organization: { id: "org1", plan: "solo", planStatus: "active", stripeSubscriptionId: "sub1" },
  }),
}));
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({ subscriptions: { retrieve, update } }),
  resolvePortalConfiguration: vi.fn(),
  resolvePrice: async (_s: unknown, plan: string, interval: string) => `price_${plan}_${interval}`,
  resolvePriceByKey: async (_s: unknown, key: string) => `price_${key}`,
}));

const { switchToTeam } = await import("./billing-actions");

const item = (id: string, lookup_key: string, quantity = 1) => ({ id, quantity, price: { lookup_key } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("switchToTeam", () => {
  it("moves the mailbox add-on to the new interval together with the plan", async () => {
    retrieve.mockResolvedValue({
      id: "sub1",
      metadata: {},
      items: { data: [item("si_plan", "clozer_solo_monthly"), item("si_box", "clozer_mailbox_monthly", 2)] },
    });
    expect(await switchToTeam("year")).toEqual({ ok: true });
    const items = update.mock.calls[0][1].items;
    expect(items).toEqual([
      { id: "si_plan", price: "price_team_year", quantity: 3 },
      { id: "si_box", price: "price_clozer_mailbox_yearly", quantity: 2 },
    ]);
  });

  it("sends only the plan item without an add-on", async () => {
    retrieve.mockResolvedValue({ id: "sub1", metadata: {}, items: { data: [item("si_plan", "clozer_solo_monthly")] } });
    await switchToTeam("year");
    expect(update.mock.calls[0][1].items).toHaveLength(1);
  });
});
