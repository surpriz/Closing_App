import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() };
vi.mock("@/lib/db", () => ({
  prisma: {
    mailboxOauthState: {
      create: (...a: unknown[]) => db.create(...a),
      updateMany: (...a: unknown[]) => db.updateMany(...a),
      findUnique: (...a: unknown[]) => db.findUnique(...a),
      deleteMany: (...a: unknown[]) => db.deleteMany(...a),
    },
  },
}));

const { createOauthState, consumeOauthState, isExpiredUnusedOauthState, purgeOauthStates } = await import("./state");
const now = new Date("2026-10-28T10:00:00Z");

beforeEach(() => vi.clearAllMocks());

describe("oauth state", () => {
  it("creates a PKCE S256 state that lives 10 minutes", async () => {
    db.create.mockResolvedValue({ id: "st1" });
    const res = await createOauthState({ organizationId: "o", userId: "u", provider: "MICROSOFT", redirectTo: "/x", now });
    expect(res.id).toBe("st1");
    expect(res.codeChallenge).toBe(createHash("sha256").update(res.codeVerifier).digest("base64url"));
    const data = db.create.mock.calls[0][0].data;
    expect(data.codeVerifier).toBe(res.codeVerifier);
    expect(data.expiresAt).toEqual(new Date(now.getTime() + 600_000));
  });

  it("consumes once: the conditional update decides", async () => {
    const row = { organizationId: "o", userId: "u", provider: "MICROSOFT", codeVerifier: "v", redirectTo: null };
    db.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    db.findUnique.mockResolvedValue(row);
    expect(await consumeOauthState("st1", now)).toEqual(row);
    expect(db.updateMany.mock.calls[0][0].where).toEqual({ id: "st1", consumedAt: null, expiresAt: { gt: now } });
    expect(await consumeOauthState("st1", now)).toBeNull();
    expect(db.findUnique).toHaveBeenCalledTimes(1);
  });

  it("scopes the consumption to the expected session identity", async () => {
    db.updateMany.mockResolvedValue({ count: 0 });
    expect(await consumeOauthState("st1", now, { userId: "u2", organizationId: "o" })).toBeNull();
    expect(db.updateMany.mock.calls[0][0].where).toMatchObject({ id: "st1", userId: "u2", organizationId: "o" });
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it("tells an expired unused state from a consumed or purged one", async () => {
    db.findUnique.mockResolvedValueOnce({ consumedAt: null, expiresAt: new Date(now.getTime() - 1) });
    expect(await isExpiredUnusedOauthState("st1", now)).toBe(true);
    db.findUnique.mockResolvedValueOnce({ consumedAt: now, expiresAt: new Date(now.getTime() - 1) });
    expect(await isExpiredUnusedOauthState("st1", now)).toBe(false);
    db.findUnique.mockResolvedValueOnce({ consumedAt: null, expiresAt: new Date(now.getTime() + 1) });
    expect(await isExpiredUnusedOauthState("st1", now)).toBe(false);
    db.findUnique.mockResolvedValueOnce(null);
    expect(await isExpiredUnusedOauthState("st1", now)).toBe(false);
  });

  it("purges states expired for over an hour", async () => {
    db.deleteMany.mockResolvedValue({ count: 4 });
    expect(await purgeOauthStates(now)).toBe(4);
    expect(db.deleteMany.mock.calls[0][0].where.expiresAt.lt).toEqual(new Date(now.getTime() - 3_600_000));
  });
});
