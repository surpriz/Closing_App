import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  consume: vi.fn(),
  connect: vi.fn(),
  account: vi.fn(),
  notifyOwner: vi.fn(async () => true),
  findFirst: vi.fn(),
  update: vi.fn(async () => ({})),
  updateMany: vi.fn(async () => ({ count: 1 })),
}));

vi.mock("@/lib/db", () => ({ prisma: { mailbox: { findFirst: h.findFirst, update: h.update, updateMany: h.updateMany } } }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_WEBHOOK_TOKEN: "good-token-good-token-good-token" }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/closing/notify/preferences", () => ({
  getSellerPrefs: vi.fn(async () => ({ timezone: "Europe/Paris" })),
  sellerTimezone: (p: { timezone: string }) => p.timezone,
}));
vi.mock("../oauth/state", () => ({ consumeOauthState: h.consume }));
vi.mock("../connect", () => ({ connectProviderMailbox: h.connect }));
vi.mock("../gmail/unipile", () => ({ getUnipileAccount: h.account }));
vi.mock("../notify-owner", () => ({ notifyMailboxOwner: h.notifyOwner }));

const { handleUnipileEvent, handleUnipileNotify, hasUnipileHeaderToken } = await import("./unipile");

const NOW = new Date("2026-10-28T10:00:00Z");
const created = { status: "CREATION_SUCCESS", account_id: "acc_1", name: "state_1" };

beforeEach(() => {
  vi.clearAllMocks();
  h.account.mockResolvedValue({ address: "me@acme.test", name: "state_1", status: "OK" });
  h.connect.mockResolvedValue({ ok: true, mailboxId: "mb1", dns: {} });
});

describe("handleUnipileNotify", () => {
  it("consumes the state and creates the mailbox", async () => {
    h.consume.mockResolvedValueOnce({ organizationId: "org1", userId: "u1", provider: "GOOGLE" });
    const result = await handleUnipileNotify(created, { now: NOW });
    expect(result).toEqual({ outcome: "connected", mailboxId: "mb1" });
    expect(h.consume).toHaveBeenCalledWith("state_1", NOW);
    expect(h.connect.mock.calls[0][0]).toMatchObject({
      organizationId: "org1",
      userId: "u1",
      provider: "GOOGLE",
      connector: "UNIPILE",
      email: "me@acme.test",
      credentials: { v: 1, kind: "unipile", accountId: "acc_1" },
      externalAccountId: "acc_1",
      timezone: "Europe/Paris",
    });
  });

  it("accepts a reconnect", async () => {
    h.consume.mockResolvedValueOnce({ organizationId: "org1", userId: "u1", provider: "GOOGLE" });
    expect((await handleUnipileNotify({ ...created, status: "RECONNECTED" })).outcome).toBe("connected");
  });

  it("uses the state once: a replay creates nothing", async () => {
    h.consume.mockResolvedValueOnce({ organizationId: "org1", userId: "u1", provider: "GOOGLE" }).mockResolvedValueOnce(null);
    await handleUnipileNotify(created);
    expect((await handleUnipileNotify(created)).outcome).toBe("invalid_state");
    expect(h.connect).toHaveBeenCalledTimes(1);
  });

  it("ignores other statuses and malformed payloads without touching the state", async () => {
    expect((await handleUnipileNotify({ ...created, status: "CREATION_FAIL" })).outcome).toBe("ignored");
    expect((await handleUnipileNotify(null)).outcome).toBe("ignored");
    expect((await handleUnipileNotify({ status: "CREATION_SUCCESS" })).outcome).toBe("ignored");
    expect(h.consume).not.toHaveBeenCalled();
  });

  it("reports a refused connection without throwing", async () => {
    h.consume.mockResolvedValueOnce({ organizationId: "org1", userId: "u1", provider: "GOOGLE" });
    h.connect.mockResolvedValueOnce({ ok: false, code: "limit", message: "too many mailboxes" });
    expect((await handleUnipileNotify(created)).outcome).toBe("failed");
  });
});

describe("handleUnipileEvent", () => {
  it("mail_received asks for a sync", async () => {
    h.findFirst.mockResolvedValueOnce({ id: "mb1", status: "ACTIVE" });
    const out = await handleUnipileEvent({ event: "mail_received", account_id: "acc_1" }, NOW);
    expect(out).toEqual({ action: "sync", mailboxId: "mb1" });
    expect(h.update).toHaveBeenCalledWith({ where: { id: "mb1" }, data: { syncRequestedAt: NOW } });
    expect(h.findFirst.mock.calls[0][0].where).toMatchObject({ connector: "UNIPILE", externalAccountId: "acc_1" });
  });

  it("CREDENTIALS puts the mailbox in error and tells the owner", async () => {
    h.findFirst.mockResolvedValueOnce({ id: "mb1", status: "ACTIVE" });
    const out = await handleUnipileEvent({ event: "account_status", account_id: "acc_1", status: "CREDENTIALS" }, NOW);
    expect(out).toEqual({ action: "auth_revoked", mailboxId: "mb1" });
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: "mb1", status: "ACTIVE" },
      data: { status: "ERROR", lastError: "AUTH_REVOKED: unipile CREDENTIALS", lastErrorAt: NOW },
    });
    expect(h.notifyOwner).toHaveBeenCalledWith("mb1", "auth_revoked", "unipile CREDENTIALS", NOW);
  });

  it("reads the nested account status shape", async () => {
    h.findFirst.mockResolvedValueOnce({ id: "mb1", status: "ACTIVE" });
    const out = await handleUnipileEvent({ AccountStatus: { account_id: "acc_1", message: "DISCONNECTED" } }, NOW);
    expect(out.action).toBe("auth_revoked");
  });

  it("does nothing for unknown events, healthy statuses, unknown accounts or bad payloads", async () => {
    h.findFirst.mockResolvedValue({ id: "mb1", status: "ACTIVE" });
    expect((await handleUnipileEvent({ event: "mail_sent", account_id: "acc_1" })).action).toBe("none");
    expect((await handleUnipileEvent({ event: "account_status", account_id: "acc_1", status: "OK" })).action).toBe("none");
    expect((await handleUnipileEvent("nope")).action).toBe("none");
    expect((await handleUnipileEvent(null)).action).toBe("none");
    h.findFirst.mockResolvedValue(null);
    expect((await handleUnipileEvent({ event: "mail_received", account_id: "ghost" })).action).toBe("none");
    expect(h.update).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.notifyOwner).not.toHaveBeenCalled();
  });

  it("does not notify when the mailbox was not active", async () => {
    h.findFirst.mockResolvedValueOnce({ id: "mb1", status: "ERROR" });
    h.updateMany.mockResolvedValueOnce({ count: 0 });
    const out = await handleUnipileEvent({ event: "account_status", account_id: "acc_1", status: "CREDENTIALS" });
    expect(out.action).toBe("none");
    expect(h.notifyOwner).not.toHaveBeenCalled();
  });
});

describe("hasUnipileHeaderToken", () => {
  const req = (token?: string) =>
    new Request("https://app.test/x", { headers: token ? { "x-clozer-token": token } : {} });
  it("matches the shared token only", () => {
    expect(hasUnipileHeaderToken(req("good-token-good-token-good-token"))).toBe(true);
    expect(hasUnipileHeaderToken(req("bad"))).toBe(false);
    expect(hasUnipileHeaderToken(req())).toBe(false);
  });
});
