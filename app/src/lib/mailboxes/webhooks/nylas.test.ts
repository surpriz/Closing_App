import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = { mailbox: { findMany: vi.fn(), updateMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma }));
const notifyMailboxOwner = vi.fn();
vi.mock("../notify-owner", () => ({ notifyMailboxOwner: (...a: unknown[]) => notifyMailboxOwner(...a) }));

const { handleNylasEvent, nylasChallenge, verifyNylasSignature } = await import("./nylas");
const { signPayload } = await import("@/lib/crypto");

const now = new Date("2026-10-28T10:00:00Z");
const event = (type: string, grant = "g1") => ({ type, data: { object: { grant_id: grant } } });

beforeEach(() => vi.clearAllMocks());

describe("verifyNylasSignature", () => {
  const body = '{"type":"message.created"}';
  it("accepts the HMAC of the raw body", () => {
    expect(verifyNylasSignature(body, signPayload(body, "sec"), "sec")).toBe(true);
  });
  it("rejects a wrong signature, a tampered body, a missing secret or header", () => {
    expect(verifyNylasSignature(body, signPayload(body, "other"), "sec")).toBe(false);
    expect(verifyNylasSignature(body + " ", signPayload(body, "sec"), "sec")).toBe(false);
    expect(verifyNylasSignature(body, signPayload(body, "sec"), undefined)).toBe(false);
    expect(verifyNylasSignature(body, null, "sec")).toBe(false);
    expect(verifyNylasSignature(body, "short", "sec")).toBe(false);
  });
});

describe("nylasChallenge", () => {
  it("echoes a plain token and refuses markup", () => {
    expect(nylasChallenge("abc-123")).toBe("abc-123");
    expect(nylasChallenge("<script>")).toBeNull();
    expect(nylasChallenge(null)).toBeNull();
  });
});

describe("handleNylasEvent", () => {
  it("message.created asks for a sync", async () => {
    prisma.mailbox.findMany.mockResolvedValue([{ id: "mb1" }]);
    expect(await handleNylasEvent(event("message.created"), now)).toEqual({ syncMailboxIds: ["mb1"] });
    expect(prisma.mailbox.findMany.mock.calls[0][0].where).toMatchObject({ connector: "NYLAS", externalAccountId: "g1" });
    expect(prisma.mailbox.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["mb1"] } }, data: { syncRequestedAt: now } });
  });
  it("fans out to every workspace sharing the grant", async () => {
    prisma.mailbox.findMany.mockResolvedValue([{ id: "mb1" }, { id: "mb2" }]);
    prisma.mailbox.updateMany.mockResolvedValue({ count: 1 });
    expect(await handleNylasEvent(event("message.created"), now)).toEqual({ syncMailboxIds: ["mb1", "mb2"] });
    await handleNylasEvent(event("grant.expired"), now);
    expect(notifyMailboxOwner).toHaveBeenCalledTimes(2);
  });
  it("grant.expired sets ERROR and tells the owner", async () => {
    prisma.mailbox.findMany.mockResolvedValue([{ id: "mb1" }]);
    prisma.mailbox.updateMany.mockResolvedValue({ count: 1 });
    expect(await handleNylasEvent(event("grant.expired"), now)).toEqual({ syncMailboxIds: [] });
    expect(prisma.mailbox.updateMany.mock.calls[0][0].data).toMatchObject({ status: "ERROR", lastError: "AUTH_REVOKED: nylas grant.expired" });
    expect(notifyMailboxOwner).toHaveBeenCalledWith("mb1", "auth_revoked", "nylas grant.expired", now);
  });
  it("does not notify twice when the mailbox already left ACTIVE", async () => {
    prisma.mailbox.findMany.mockResolvedValue([{ id: "mb1" }]);
    prisma.mailbox.updateMany.mockResolvedValue({ count: 0 });
    await handleNylasEvent(event("grant.error"), now);
    expect(notifyMailboxOwner).not.toHaveBeenCalled();
  });
  it("ignores unknown grants, events and malformed payloads", async () => {
    prisma.mailbox.findMany.mockResolvedValue([]);
    expect(await handleNylasEvent(event("message.created", "nope"), now)).toEqual({ syncMailboxIds: [] });
    expect(await handleNylasEvent(event("message.updated"), now)).toEqual({ syncMailboxIds: [] });
    expect(await handleNylasEvent(null, now)).toEqual({ syncMailboxIds: [] });
    expect(prisma.mailbox.updateMany).not.toHaveBeenCalled();
  });
});
