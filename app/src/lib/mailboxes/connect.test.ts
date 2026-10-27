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

const { connectImapMailbox, disconnectMailbox, updateMailboxCap } = await import("./connect");

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

  it("resets the ramp of a mailbox disconnected for over 30 days", async () => {
    db.findUnique.mockResolvedValue({ id: "mb1", status: "DISCONNECTED", userId: "u1", disconnectedAt: new Date("2026-08-01T00:00:00Z") });
    await connectImapMailbox(input, { resolver, now });
    expect(db.upsert.mock.calls[0][0].update.rampStartedAt).toEqual(now);
  });

  it("keeps the ramp of a recently disconnected mailbox", async () => {
    db.findUnique.mockResolvedValue({ id: "mb1", status: "DISCONNECTED", userId: "u1", disconnectedAt: new Date("2026-10-20T00:00:00Z") });
    await connectImapMailbox(input, { resolver, now });
    expect(db.upsert.mock.calls[0][0].update).not.toHaveProperty("rampStartedAt");
  });
});

describe("disconnectMailbox", () => {
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
    expect(await updateMailboxCap("org1", "u1", "mb1", 500)).toBe(50);
    expect(await updateMailboxCap("org1", "u1", "mb1", 0)).toBe(1);
  });
});
