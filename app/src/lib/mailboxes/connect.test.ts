import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  findUnique: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  prisma: {
    mailbox: {
      findUnique: (...a: unknown[]) => db.findUnique(...a),
      count: (...a: unknown[]) => db.count(...a),
      upsert: (...a: unknown[]) => db.upsert(...a),
      updateMany: (...a: unknown[]) => db.updateMany(...a),
      findFirst: (...a: unknown[]) => db.findFirst(...a),
      update: (...a: unknown[]) => db.update(...a),
    },
  },
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_DAILY_CAP_DEFAULT: 30, MAILBOX_DAILY_CAP_MAX: 50 }) }));
const verify = vi.fn();
vi.mock("./imap", () => ({ imapConnector: () => ({ verify: () => verify() }) }));
const encode = vi.fn((c: unknown) => `enc:${(c as { kind: string }).kind}`);
vi.mock("./credentials", () => ({ encodeCredentials: (c: unknown) => encode(c) }));

const runChecks = vi.fn();
vi.mock("./dns/checks", async (orig) => {
  const actual = await orig<typeof import("./dns/checks")>();
  return {
    ...actual,
    runDnsChecks: (...a: Parameters<typeof actual.runDnsChecks>) => {
      runChecks(...a);
      return actual.runDnsChecks(...a);
    },
  };
});
const providerDisconnect = vi.fn();
vi.mock("./index", () => ({
  connectorFor: (mailbox: unknown) => ({ verify: () => verify(), disconnect: () => providerDisconnect(mailbox) }),
}));

const { connectImapMailbox, connectProviderMailbox, disconnectMailbox, recheckMailboxDns, updateMailboxCap } = await import("./connect");

const resolver = {
  mx: async () => [{ exchange: "mx1.mail.ovh.net", priority: 1 }],
  txt: async () => [],
  cname: async () => [],
};
const now = new Date("2026-10-27T10:00:00Z");
const input = {
  organizationId: "org1",
  userId: "u1",
  email: "Jean@Acme.fr",
  displayName: "Jean",
  timezone: "Europe/Paris",
  imap: { host: "ssl0.ovh.net", port: 993, secure: true },
  smtp: { host: "ssl0.ovh.net", port: 465, secure: true },
  password: "s3cret-pass",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.findUnique.mockResolvedValue(null);
  db.count.mockResolvedValue(0);
  db.upsert.mockResolvedValue({ id: "mb1" });
  verify.mockResolvedValue({ ok: true, address: "jean@acme.fr", displayName: "Jean" });
});

describe("connectImapMailbox", () => {
  it("refuses an email already live in the workspace", async () => {
    db.findUnique.mockResolvedValue({ id: "x", status: "ACTIVE", disconnectedAt: null, userId: "u2" });
    const res = await connectImapMailbox(input, { resolver, now });
    expect(res).toMatchObject({ ok: false, code: "exists" });
    expect(verify).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("lets the owner reconnect a mailbox in ERROR: verified again, ACTIVE, ramp kept", async () => {
    db.findUnique.mockResolvedValue({ id: "mb1", status: "ERROR", userId: "u1", disconnectedAt: null });
    db.count.mockResolvedValue(3);
    const res = await connectImapMailbox(input, { resolver, now });
    expect(res).toMatchObject({ ok: true, mailboxId: "mb1" });
    expect(verify).toHaveBeenCalledTimes(1);
    const { update } = db.upsert.mock.calls[0][0];
    expect(update).toMatchObject({ status: "ACTIVE", lastError: null, syncErrorCount: 0, userId: "u1" });
    expect(update).not.toHaveProperty("rampStartedAt");
  });

  it("keeps refusing a mailbox in ERROR that belongs to another member", async () => {
    db.findUnique.mockResolvedValue({ id: "mb1", status: "ERROR", userId: "u2", disconnectedAt: null });
    const res = await connectImapMailbox(input, { resolver, now });
    expect(res).toMatchObject({ ok: false, code: "exists" });
    expect(verify).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("writes nothing when verification fails", async () => {
    verify.mockResolvedValue({ ok: false, code: "AUTH_REVOKED", message: "bad login" });
    const res = await connectImapMailbox(input, { resolver, now });
    expect(res).toEqual({ ok: false, code: "AUTH_REVOKED", message: "bad login" });
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("stores only the encoded credentials, never the password", async () => {
    const res = await connectImapMailbox(input, { resolver, now });
    expect(res).toMatchObject({ ok: true, mailboxId: "mb1" });
    expect(encode).toHaveBeenCalledTimes(1);
    const args = db.upsert.mock.calls[0][0];
    expect(JSON.stringify(args)).not.toContain("s3cret-pass");
    expect(args.create).toMatchObject({
      email: "jean@acme.fr",
      domain: "acme.fr",
      credentials: "enc:imap",
      provider: "IMAP",
      connector: "SMTP",
      status: "ACTIVE",
      dailyCap: 30,
    });
  });

  it("checks DNS for the MX-detected provider while storing IMAP", async () => {
    const msResolver = { ...resolver, mx: async () => [{ exchange: "acme-fr.mail.protection.outlook.com", priority: 0 }] };
    await connectImapMailbox(input, { resolver: msResolver, now });
    expect(runChecks.mock.calls[0][0]).toMatchObject({ provider: "MICROSOFT" });
    expect(db.upsert.mock.calls[0][0].create).toMatchObject({ provider: "IMAP", connector: "SMTP" });
  });

  it("refuses past the per-user mailbox limit without verifying", async () => {
    db.count.mockResolvedValue(3);
    const res = await connectImapMailbox(input, { resolver, now });
    expect(res).toMatchObject({ ok: false, code: "limit" });
    expect(verify).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("resets the ramp of a mailbox disconnected for over 30 days", async () => {
    db.findUnique.mockResolvedValue({ id: "mb1", status: "DISCONNECTED", userId: "u1", disconnectedAt: new Date("2026-08-01T00:00:00Z") });
    await connectImapMailbox(input, { resolver, now });
    expect(db.upsert.mock.calls[0][0].update.rampStartedAt).toEqual(now);
  });

  it("keeps the ramp of a recently disconnected mailbox", async () => {
    db.findUnique.mockResolvedValue({ id: "mb1", status: "DISCONNECTED", userId: "u1", disconnectedAt: new Date("2026-10-20T00:00:00Z") });
    await connectImapMailbox(input, { resolver, now });
    expect(db.upsert.mock.calls[0][0].update).not.toHaveProperty("rampStartedAt");
    expect(db.upsert.mock.calls[0][0].update).not.toHaveProperty("dailyCap");
  });
});

const providerInput = {
  organizationId: "org1",
  userId: "u1",
  provider: "MICROSOFT" as const,
  connector: "GRAPH" as const,
  email: "Jean@Acme.fr",
  displayName: "Jean",
  credentials: { v: 1 as const, kind: "unipile" as const, accountId: "acc1" },
  externalAccountId: "acc1",
  timezone: "Europe/Paris",
};

describe("connectProviderMailbox", () => {
  it("applies the same guards: exists, then limit", async () => {
    db.findUnique.mockResolvedValue({ id: "x", status: "ACTIVE", disconnectedAt: null, userId: "u2" });
    expect(await connectProviderMailbox(providerInput, { resolver, now })).toMatchObject({ ok: false, code: "exists" });
    db.findUnique.mockResolvedValue(null);
    db.count.mockResolvedValue(3);
    expect(await connectProviderMailbox(providerInput, { resolver, now })).toMatchObject({ ok: false, code: "limit" });
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("lets the owner reconnect a mailbox in ERROR past the limit", async () => {
    db.findUnique.mockResolvedValue({ id: "mb1", status: "ERROR", userId: "u1", disconnectedAt: null });
    db.count.mockResolvedValue(3);
    const res = await connectProviderMailbox(providerInput, { resolver, now });
    expect(res).toMatchObject({ ok: true, mailboxId: "mb1" });
    expect(db.upsert.mock.calls[0][0].update).not.toHaveProperty("rampStartedAt");
  });

  it("verifies through the injected function and writes nothing on failure", async () => {
    const injected = vi.fn().mockResolvedValue({ ok: false, code: "AUTH_REVOKED", message: "revoked" });
    const res = await connectProviderMailbox(providerInput, { resolver, now, verify: injected });
    expect(res).toEqual({ ok: false, code: "AUTH_REVOKED", message: "revoked" });
    expect(injected).toHaveBeenCalledTimes(1);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("stores the chosen provider, connector and external account", async () => {
    const injected = vi.fn().mockResolvedValue({ ok: true, address: "jean@acme.fr", displayName: null });
    const res = await connectProviderMailbox(providerInput, { resolver, now, verify: injected });
    expect(res).toMatchObject({ ok: true, mailboxId: "mb1" });
    expect(db.upsert.mock.calls[0][0].create).toMatchObject({
      email: "jean@acme.fr",
      provider: "MICROSOFT",
      connector: "GRAPH",
      externalAccountId: "acc1",
      credentials: "enc:unipile",
      status: "ACTIVE",
    });
  });
});

describe("disconnectMailbox", () => {
  it("revokes at the provider first, and still disconnects when that throws", async () => {
    db.findFirst.mockResolvedValue({ id: "mb1", credentials: "enc", subscriptionId: "sub1" });
    providerDisconnect.mockRejectedValue(new Error("boom"));
    db.updateMany.mockResolvedValue({ count: 1 });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await disconnectMailbox("org1", "u1", "mb1", now)).toBe(true);
    expect(providerDisconnect).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: "sub1" }));
    expect(db.updateMany).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("wipes the credentials and is scoped to the user and workspace", async () => {
    db.updateMany.mockResolvedValue({ count: 1 });
    expect(await disconnectMailbox("org1", "u1", "mb1", now)).toBe(true);
    const args = db.updateMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ id: "mb1", organizationId: "org1", userId: "u1" });
    expect(args.data).toMatchObject({ status: "DISCONNECTED", credentials: "", disconnectedAt: now });
  });
});

describe("updateMailboxCap", () => {
  it("clamps to [1, max]", async () => {
    db.updateMany.mockResolvedValue({ count: 1 });
    db.findFirst.mockResolvedValue({ email: "jean@acme.fr" });
    expect(await updateMailboxCap("org1", "u1", "mb1", 500)).toEqual({ cap: 50, email: "jean@acme.fr" });
    expect(db.updateMany.mock.calls[0][0].where).toMatchObject({ id: "mb1", organizationId: "org1", userId: "u1" });
    expect(await updateMailboxCap("org1", "u1", "mb1", 0)).toMatchObject({ cap: 1 });
  });
});

describe("recheckMailboxDns", () => {
  const stored = (probe: object) => ({
    id: "mb1", domain: "acme.fr", provider: "IMAP", dkimSelector: "sel1",
    dnsDetail: { dkim: { status: "verified", selector: "sel1" }, probe },
  });
  const probeAt = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  beforeEach(() => db.update.mockResolvedValue({}));

  it("keeps a recent verified probe when DNS cannot see the key", async () => {
    db.findFirst.mockResolvedValue(stored({ at: probeAt(10), verified: true, selector: "sel1" }));
    const report = await recheckMailboxDns("org1", "u1", "mb1", resolver, now);
    expect(report?.dkim).toEqual({ status: "verified", selector: "sel1" });
    const { data } = db.update.mock.calls[0][0];
    expect(data.dkimOk).toBe(true);
    expect(data.dnsDetail.probe.verified).toBe(true);
  });

  it("lets DNS win once the probe is older than 90 days", async () => {
    db.findFirst.mockResolvedValue(stored({ at: probeAt(120), verified: true, selector: "sel1" }));
    const report = await recheckMailboxDns("org1", "u1", "mb1", resolver, now);
    expect(report?.dkim.status).toBe("unknown");
    expect(db.update.mock.calls[0][0].data.dkimOk).toBeNull();
  });

  it("lets a DNS verdict win over the probe", async () => {
    db.findFirst.mockResolvedValue(stored({ at: probeAt(1), verified: true, selector: "sel1" }));
    const revoked = { ...resolver, txt: async (host: string) => (host.includes("_domainkey") ? ["v=DKIM1; p="] : []) };
    const report = await recheckMailboxDns("org1", "u1", "mb1", revoked, now);
    expect(report?.dkim.status).toBe("revoked");
    expect(db.update.mock.calls[0][0].data.dkimOk).toBe(false);
  });
});
