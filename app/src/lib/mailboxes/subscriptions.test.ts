import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOUR_MS } from "@/lib/closing/constants";

import { MailboxError } from "./errors";
import type { MailboxConnector } from "./types";

const prisma = { mailbox: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("./index", () => ({ connectorFor: vi.fn() }));
const enabled = vi.fn();
vi.mock("./config", () => ({
  mailboxWebhooksEnabled: () => enabled(),
  mailboxWebhookUrl: (name: string) => `https://app.test/api/webhooks/mailboxes/${name}?token=t`,
}));
vi.mock("./webhooks/token", () => ({ clientStateFor: (id: string) => `cs-${id}` }));
const notifyMailboxOwner = vi.fn();
vi.mock("./notify-owner", () => ({ notifyMailboxOwner: (...a: unknown[]) => notifyMailboxOwner(...a) }));

const { maintainSubscriptions, MAX_SUBSCRIPTIONS_PER_TICK, MAX_NEW_SUBSCRIPTIONS_PER_TICK } = await import("./subscriptions");

const NOW = new Date("2026-10-28T10:00:00Z");
const row = (extra: Record<string, unknown> = {}) => ({
  id: "mb1",
  provider: "MICROSOFT",
  connector: "GRAPH",
  email: "a@acme.com",
  displayName: null,
  credentials: "x",
  subscriptionId: null,
  subscriptionExpiresAt: null,
  ...extra,
});
const expires = new Date(NOW.getTime() + 70 * HOUR_MS);

function fake(extra: Partial<MailboxConnector> = {}, webhooks = true) {
  return {
    capabilities: { webhooks },
    subscribe: vi.fn().mockResolvedValue({ subscriptionId: "sub-new", expiresAt: expires }),
    renew: vi.fn().mockResolvedValue({ expiresAt: expires }),
    ...extra,
  } as unknown as MailboxConnector & { subscribe: ReturnType<typeof vi.fn>; renew: ReturnType<typeof vi.fn> };
}
const run = (connector: MailboxConnector) => maintainSubscriptions(NOW, { budgetMs: 10_000, connector: () => connector });

/** The tick reads renewals and new subscriptions separately: route each row by whether it has an expiry. */
function rows(list: ReturnType<typeof row>[]) {
  prisma.mailbox.findMany.mockImplementation(async (q: { where: { subscriptionExpiresAt: unknown }; take: number }) =>
    list.filter((r) => (q.where.subscriptionExpiresAt === null) === (r.subscriptionExpiresAt === null)).slice(0, q.take),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  enabled.mockReturnValue(true);
  prisma.mailbox.update.mockResolvedValue({});
  prisma.mailbox.updateMany.mockResolvedValue({ count: 1 });
});

describe("maintainSubscriptions", () => {
  it("does nothing while webhooks are off", async () => {
    enabled.mockReturnValue(false);
    expect(await run(fake())).toEqual({ subscribed: 0, renewed: 0, errors: 0 });
    expect(prisma.mailbox.findMany).not.toHaveBeenCalled();
  });

  it("reads renewals first and caps the rows without an expiry", async () => {
    const renewing = Array.from({ length: 3 }, (_, i) =>
      row({ id: `r${i}`, subscriptionId: `s${i}`, subscriptionExpiresAt: new Date(NOW.getTime() + HOUR_MS) }),
    );
    const fresh = Array.from({ length: 9 }, (_, i) => row({ id: `n${i}` }));
    rows([...fresh, ...renewing] as never);
    const connector = fake();
    const out = await run(connector);
    expect(out.renewed).toBe(3);
    expect(out.subscribed).toBe(MAX_NEW_SUBSCRIPTIONS_PER_TICK);
    expect(prisma.mailbox.findMany.mock.calls[0][0].take).toBe(MAX_SUBSCRIPTIONS_PER_TICK);
    expect(connector.renew.mock.invocationCallOrder[0]).toBeLessThan(connector.subscribe.mock.invocationCallOrder[0]);
  });

  it("subscribes a mailbox that has none", async () => {
    rows([row()] as never);
    const connector = fake();
    expect(await run(connector)).toEqual({ subscribed: 1, renewed: 0, errors: 0 });
    expect(connector.subscribe).toHaveBeenCalledWith({
      notificationUrl: "https://app.test/api/webhooks/mailboxes/microsoft?token=t",
      clientState: "cs-mb1",
    });
    expect(prisma.mailbox.update).toHaveBeenCalledWith({
      where: { id: "mb1" },
      data: { subscriptionId: "sub-new", subscriptionExpiresAt: expires },
    });
  });

  it("renews inside the 36 hour window", async () => {
    rows([row({ subscriptionId: "s1", subscriptionExpiresAt: new Date(NOW.getTime() + 35 * HOUR_MS) })] as never);
    const connector = fake();
    expect(await run(connector)).toEqual({ subscribed: 0, renewed: 1, errors: 0 });
    expect(connector.renew).toHaveBeenCalledWith("s1");
    expect(connector.subscribe).not.toHaveBeenCalled();
    expect(prisma.mailbox.update).toHaveBeenCalledWith({ where: { id: "mb1" }, data: { subscriptionExpiresAt: expires } });
  });

  it("leaves a fresh subscription alone", async () => {
    rows([row({ subscriptionId: "s1", subscriptionExpiresAt: new Date(NOW.getTime() + 40 * HOUR_MS) })] as never);
    const connector = fake();
    expect(await run(connector)).toEqual({ subscribed: 0, renewed: 0, errors: 0 });
    expect(connector.renew).not.toHaveBeenCalled();
    expect(connector.subscribe).not.toHaveBeenCalled();
  });

  it("recreates a subscription Graph no longer knows", async () => {
    rows([row({ subscriptionId: "s1" })] as never);
    const connector = fake({ renew: vi.fn().mockRejectedValue(new MailboxError("REJECTED", "x", { detail: "graph 404 ResourceNotFound" })) });
    expect(await run(connector)).toEqual({ subscribed: 1, renewed: 0, errors: 0 });
    expect(prisma.mailbox.update).toHaveBeenCalledWith({
      where: { id: "mb1" },
      data: { subscriptionId: "sub-new", subscriptionExpiresAt: expires },
    });
  });

  it("ignores connectors without push subscriptions", async () => {
    rows([row({ connector: "NYLAS" })] as never);
    const connector = fake({}, false);
    expect(await run(connector)).toEqual({ subscribed: 0, renewed: 0, errors: 0 });
    expect(connector.subscribe).not.toHaveBeenCalled();
    const bare = { capabilities: { webhooks: true } } as unknown as MailboxConnector;
    expect(await run(bare)).toEqual({ subscribed: 0, renewed: 0, errors: 0 });
  });

  it("parks a mailbox whose login was revoked and tells the owner", async () => {
    rows([row()] as never);
    const connector = fake({ subscribe: vi.fn().mockRejectedValue(new MailboxError("AUTH_REVOKED", "x", { detail: "invalid_grant" })) });
    expect(await run(connector)).toEqual({ subscribed: 0, renewed: 0, errors: 1 });
    expect(prisma.mailbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mb1", status: "ACTIVE" }, data: expect.objectContaining({ status: "ERROR" }) }),
    );
    expect(notifyMailboxOwner).toHaveBeenCalledWith("mb1", "auth_revoked", "invalid_grant", NOW);
  });

  it("keeps going after a transient failure without touching the mailbox", async () => {
    rows([row({ id: "a" }), row({ id: "b" })] as never);
    const subscribe = vi
      .fn()
      .mockRejectedValueOnce(new MailboxError("TRANSIENT", "x"))
      .mockResolvedValueOnce({ subscriptionId: "s", expiresAt: expires });
    expect(await run(fake({ subscribe }))).toEqual({ subscribed: 1, renewed: 0, errors: 1 });
    expect(prisma.mailbox.updateMany).not.toHaveBeenCalled();
    expect(notifyMailboxOwner).not.toHaveBeenCalled();
  });
});
