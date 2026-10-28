import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { handleNylasCallback } = await import("./nylas-callback");

const now = new Date("2026-10-28T10:00:00Z");
const consumed = { organizationId: "o1", userId: "u1", provider: "GOOGLE", codeVerifier: null, redirectTo: null };
function setup(over: Record<string, unknown> = {}) {
  const deps = {
    consumeState: vi.fn().mockResolvedValue(consumed),
    exchange: vi.fn().mockResolvedValue({ grantId: "g1", email: "me@acme.io" }),
    connect: vi.fn().mockResolvedValue({ ok: true, mailboxId: "mb1", dns: {} }),
    timezone: vi.fn().mockResolvedValue("Europe/Paris"),
    audit: vi.fn(),
    now: () => now,
    ...over,
  };
  const run = (p: Partial<{ code: string | null; state: string | null; error: string | null }> = {}) =>
    handleNylasCallback(
      { code: "c", state: "s", error: null, user: { id: "u1" }, organizationId: "o1", ...p },
      deps as never,
    );
  return { deps, run };
}

describe("handleNylasCallback", () => {
  it("connects the mailbox and redirects", async () => {
    const { deps, run } = setup();
    expect(await run()).toBe("/settings?mailbox=connected#boite");
    expect(deps.consumeState).toHaveBeenCalledWith("s", now, { userId: "u1", organizationId: "o1" });
    expect(deps.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "GOOGLE",
        connector: "NYLAS",
        email: "me@acme.io",
        externalAccountId: "g1",
        credentials: { v: 1, kind: "nylas", grantId: "g1" },
        timezone: "Europe/Paris",
      }),
    );
    expect(deps.audit).toHaveBeenCalled();
  });
  it("refuses a state that is spent, expired or not the member's", async () => {
    const { deps, run } = setup({ consumeState: vi.fn().mockResolvedValue(null) });
    expect(await run()).toBe("/settings?mailbox=expired#boite");
    expect(deps.exchange).not.toHaveBeenCalled();
  });
  it("double-checks the owner of the returned state", async () => {
    const { deps, run } = setup({ consumeState: vi.fn().mockResolvedValue({ ...consumed, userId: "other" }) });
    expect(await run()).toBe("/settings?mailbox=expired#boite");
    expect(deps.exchange).not.toHaveBeenCalled();
  });
  it("handles a cancelled consent and missing params", async () => {
    const { deps, run } = setup();
    expect(await run({ error: "access_denied" })).toBe("/settings?mailbox=cancelled#boite");
    expect(await run({ code: null })).toBe("/settings?mailbox=expired#boite");
    expect(deps.consumeState).not.toHaveBeenCalled();
  });
  it("reports connect refusals and exchange failures", async () => {
    expect(await setup({ connect: vi.fn().mockResolvedValue({ ok: false, code: "limit", message: "" }) }).run()).toBe(
      "/settings?mailbox=limit#boite",
    );
    expect(await setup({ connect: vi.fn().mockResolvedValue({ ok: false, code: "AUTH_REVOKED", message: "" }) }).run()).toBe(
      "/settings?mailbox=failed#boite",
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await setup({ exchange: vi.fn().mockRejectedValue(new Error("x")) }).run()).toBe("/settings?mailbox=failed#boite");
  });
});
