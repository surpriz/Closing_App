import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  consume: vi.fn(),
  peek: vi.fn(),
  expired: vi.fn(async () => false),
  connect: vi.fn(),
  account: vi.fn(),
  notifyOwner: vi.fn(async () => true),
  findFirst: vi.fn(),
  findUnique: vi.fn(async (): Promise<unknown> => null),
  disconnect: vi.fn(async () => {}),
  update: vi.fn(async () => ({})),
  updateMany: vi.fn(async () => ({ count: 1 })),
}));

vi.mock("@/lib/db", () => ({ prisma: { mailbox: { findFirst: h.findFirst, findUnique: h.findUnique, update: h.update, updateMany: h.updateMany } } }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_WEBHOOK_TOKEN: "good-token-good-token-good-token" }) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/closing/notify/preferences", () => ({
  getSellerPrefs: vi.fn(async () => ({ timezone: "Europe/Paris" })),
  sellerTimezone: (p: { timezone: string }) => p.timezone,
}));
vi.mock("../oauth/state", () => ({ consumeOauthState: h.consume, isExpiredUnusedOauthState: h.expired, peekOauthState: h.peek }));
vi.mock("../connect", () => ({ connectProviderMailbox: h.connect }));
vi.mock("../gmail/unipile", () => ({
  getUnipileAccount: h.account,
  unipileConnector: () => ({ disconnect: h.disconnect }),
}));
vi.stubEnv("ENCRYPTION_KEY", "k".repeat(40));
vi.mock("../notify-owner", () => ({ notifyMailboxOwner: h.notifyOwner }));

const { handleUnipileEvent, handleUnipileNotify, hasUnipileHeaderToken } = await import("./unipile");
const { unipileHeaderToken } = await import("./unipile-secrets");

const NOW = new Date("2026-10-28T10:00:00Z");
const created = { status: "CREATION_SUCCESS", account_id: "acc_1", name: "state_1" };
// The state was written five minutes before the account came back; Unipile's `name` is its own label, never ours
const PENDING = { provider: "GOOGLE", redirectTo: null, createdAt: new Date("2026-10-28T09:55:00Z") };
const ACCOUNT = { address: "me@acme.test", name: "Me", status: "OK", createdAt: new Date("2026-10-28T09:59:30Z") };

beforeEach(() => {
  vi.clearAllMocks();
  h.account.mockResolvedValue(ACCOUNT);
  h.peek.mockResolvedValue(PENDING);
  h.findFirst.mockReset();
  h.findFirst.mockResolvedValue(null);
  h.findUnique.mockResolvedValue(null);
  h.connect.mockResolvedValue({ ok: true, mailboxId: "mb1", dns: {} });
  h.expired.mockResolvedValue(false);
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

  it("drops the account made for a state that expired unused, unless a mailbox points at it", async () => {
    h.consume.mockResolvedValueOnce(null);
    h.expired.mockResolvedValueOnce(true);
    expect((await handleUnipileNotify(created, { now: NOW })).outcome).toBe("invalid_state");
    expect(h.expired).toHaveBeenCalledWith("state_1", NOW);
    expect(h.connect).not.toHaveBeenCalled();
    expect(h.disconnect).toHaveBeenCalledTimes(1);

    h.consume.mockResolvedValueOnce(null);
    h.expired.mockResolvedValueOnce(true);
    h.findFirst.mockResolvedValueOnce({ id: "mb1" });
    expect((await handleUnipileNotify(created)).outcome).toBe("invalid_state");
    expect(h.disconnect).toHaveBeenCalledTimes(1);
  });

  it("a duplicate delivery never deletes the account a sibling is still connecting", async () => {
    // A consumed the state and sits in connectProviderMailbox: no mailbox row points at the account yet
    let finishA!: () => void;
    h.consume.mockResolvedValueOnce(state).mockResolvedValueOnce(null);
    h.connect.mockImplementationOnce(
      () => new Promise((resolve) => (finishA = () => resolve({ ok: true, mailboxId: "mb1", dns: {} }))),
    );
    const a = handleUnipileNotify(created);
    await vi.waitFor(() => expect(h.connect).toHaveBeenCalledTimes(1));
    // B finds the state consumed (not expired): it leaves the account alone
    expect((await handleUnipileNotify(created)).outcome).toBe("invalid_state");
    expect(h.disconnect).not.toHaveBeenCalled();
    finishA();
    expect((await a).outcome).toBe("connected");
    expect(h.disconnect).not.toHaveBeenCalled();
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
    // nothing points at the account: it is deleted
    expect(h.disconnect).toHaveBeenCalledTimes(1);
  });

  const state = { organizationId: "org1", userId: "u1", provider: "GOOGLE" };

  it("refuses a state of another provider", async () => {
    h.consume.mockResolvedValueOnce({ ...state, provider: "MICROSOFT" });
    expect((await handleUnipileNotify(created)).outcome).toBe("invalid_state");
    expect(h.connect).not.toHaveBeenCalled();
  });

  it("refuses an account older than the state it claims", async () => {
    h.account.mockResolvedValueOnce({ ...ACCOUNT, createdAt: new Date("2026-10-28T09:00:00Z") });
    expect((await handleUnipileNotify(created)).outcome).toBe("invalid_state");
    expect(h.connect).not.toHaveBeenCalled();
    expect(h.disconnect).not.toHaveBeenCalled();
    // the state stays usable: a forged notification cannot burn it
    expect(h.consume).not.toHaveBeenCalled();
  });

  it("refuses an account without a creation date, and a state it does not know", async () => {
    h.account.mockResolvedValueOnce({ ...ACCOUNT, createdAt: null });
    expect((await handleUnipileNotify(created)).outcome).toBe("invalid_state");
    h.peek.mockResolvedValueOnce(null);
    expect((await handleUnipileNotify(created)).outcome).toBe("invalid_state");
    expect(h.consume).not.toHaveBeenCalled();
    expect(h.disconnect).not.toHaveBeenCalled();
  });

  it("tolerates a minute of clock skew between Unipile and us", async () => {
    h.consume.mockResolvedValueOnce(state);
    h.account.mockResolvedValueOnce({ ...ACCOUNT, createdAt: new Date("2026-10-28T09:54:10Z") });
    expect((await handleUnipileNotify(created)).outcome).toBe("connected");
  });

  it("accepts on a reconnect the account the link was issued for, whatever its age", async () => {
    h.peek.mockResolvedValue({ ...PENDING, redirectTo: "mb1" });
    h.account.mockResolvedValue({ ...ACCOUNT, createdAt: new Date("2026-09-01T00:00:00Z") });
    h.findFirst.mockResolvedValueOnce({ externalAccountId: "acc_1" }).mockResolvedValueOnce(null);
    h.consume.mockResolvedValueOnce({ ...state, redirectTo: "mb1" });
    expect((await handleUnipileNotify({ ...created, status: "RECONNECTED" })).outcome).toBe("connected");
    expect(h.findFirst.mock.calls[0][0].where).toMatchObject({ id: "mb1", connector: "UNIPILE" });
    // another account than the one reconnected: refused
    h.findFirst.mockResolvedValueOnce({ externalAccountId: "acc_old" });
    expect((await handleUnipileNotify({ ...created, account_id: "acc_2", status: "RECONNECTED" })).outcome).toBe("invalid_state");
  });

  it("keeps the state and deletes nothing when the account lookup fails", async () => {
    h.account.mockRejectedValueOnce(new Error("boom"));
    expect((await handleUnipileNotify(created)).outcome).toBe("failed");
    expect(h.consume).not.toHaveBeenCalled();
    expect(h.disconnect).not.toHaveBeenCalled();
  });

  it("refuses an account a live mailbox of another workspace already uses", async () => {
    h.consume.mockResolvedValueOnce(state);
    h.findFirst.mockResolvedValueOnce({ id: "other" });
    expect((await handleUnipileNotify(created)).outcome).toBe("failed");
    expect(h.findFirst.mock.calls[0][0].where).toMatchObject({
      connector: "UNIPILE",
      externalAccountId: "acc_1",
      organizationId: { not: "org1" },
    });
    expect(h.connect).not.toHaveBeenCalled();
    expect(h.disconnect).not.toHaveBeenCalled();
  });

  it("deletes the account when it has no address or the connection throws", async () => {
    h.consume.mockResolvedValue(state);
    h.account.mockResolvedValueOnce({ ...ACCOUNT, address: null });
    expect((await handleUnipileNotify(created)).outcome).toBe("failed");
    h.connect.mockRejectedValueOnce(new Error("boom"));
    expect((await handleUnipileNotify(created)).outcome).toBe("failed");
    expect(h.disconnect).toHaveBeenCalledTimes(2);
  });

  it("keeps an account some mailbox still points at", async () => {
    h.consume.mockResolvedValueOnce(state);
    h.connect.mockResolvedValueOnce({ ok: false, code: "exists", message: "x" });
    h.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "live" });
    await handleUnipileNotify(created);
    expect(h.disconnect).not.toHaveBeenCalled();
  });

  it("deletes the previous account when a reconnect brings a new one", async () => {
    h.consume.mockResolvedValueOnce(state);
    h.findUnique.mockResolvedValueOnce({ connector: "UNIPILE", externalAccountId: "acc_old" });
    expect((await handleUnipileNotify(created)).outcome).toBe("connected");
    expect(h.disconnect).toHaveBeenCalledTimes(1);
  });

  it("leaves the account alone on a reconnect to the same one", async () => {
    h.consume.mockResolvedValueOnce(state);
    h.findUnique.mockResolvedValueOnce({ connector: "UNIPILE", externalAccountId: "acc_1" });
    await handleUnipileNotify(created);
    expect(h.disconnect).not.toHaveBeenCalled();
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
    h.account.mockResolvedValueOnce({ address: null, name: null, status: "CREDENTIALS" });
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
    h.account.mockResolvedValueOnce({ address: null, name: null, status: "DISCONNECTED" });
    const out = await handleUnipileEvent({ AccountStatus: { account_id: "acc_1", message: "DISCONNECTED" } }, NOW);
    expect(out.action).toBe("auth_revoked");
  });

  it("does not trust an account_status that Unipile does not confirm", async () => {
    h.findFirst.mockResolvedValue({ id: "mb1", status: "ACTIVE" });
    h.account.mockResolvedValueOnce({ address: null, name: null, status: "OK" });
    expect((await handleUnipileEvent({ event: "account_status", account_id: "acc_1", status: "CREDENTIALS" })).action).toBe("none");
    h.account.mockRejectedValueOnce(new Error("down"));
    expect((await handleUnipileEvent({ event: "account_status", account_id: "acc_1", status: "CREDENTIALS" })).action).toBe("none");
    expect(h.updateMany).not.toHaveBeenCalled();
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
    h.account.mockResolvedValueOnce({ address: null, name: null, status: "CREDENTIALS" });
    h.updateMany.mockResolvedValueOnce({ count: 0 });
    const out = await handleUnipileEvent({ event: "account_status", account_id: "acc_1", status: "CREDENTIALS" });
    expect(out.action).toBe("none");
    expect(h.notifyOwner).not.toHaveBeenCalled();
  });
});

describe("hasUnipileHeaderToken", () => {
  const req = (token?: string) => new Request("https://app.test/x", { headers: token ? { "x-clozer-token": token } : {} });
  it("matches the derived token only, not the URL token", () => {
    expect(hasUnipileHeaderToken(req(unipileHeaderToken()))).toBe(true);
    expect(hasUnipileHeaderToken(req("good-token-good-token-good-token"))).toBe(false);
    expect(hasUnipileHeaderToken(req("bad"))).toBe(false);
    expect(hasUnipileHeaderToken(req())).toBe(false);
  });
});

describe("signature domain separation", () => {
  it("does not reuse the Graph client state for the same id", async () => {
    const { notifySignature } = await import("./unipile-secrets");
    const { clientStateFor } = await import("./token");
    expect(notifySignature("same-id")).not.toBe(clientStateFor("same-id"));
  });
});
