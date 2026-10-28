import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = { mailbox: { findFirst: vi.fn(), updateMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma }));
const verifyClientState = vi.fn();
vi.mock("./token", () => ({ verifyClientState: (...a: unknown[]) => verifyClientState(...a) }));

const { handleMicrosoftNotifications, microsoftValidationToken } = await import("./microsoft");

const now = new Date("2026-10-28T10:00:00Z");
const note = (extra: Record<string, unknown> = {}) => ({ subscriptionId: "sub1", clientState: "cs", changeType: "created", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.mailbox.findFirst.mockResolvedValue({ id: "mb1" });
  verifyClientState.mockReturnValue(true);
});

describe("microsoftValidationToken", () => {
  it("keeps a printable token and refuses the rest", () => {
    expect(microsoftValidationToken("Validation: Testing client application reachability")).toBe(
      "Validation: Testing client application reachability",
    );
    expect(microsoftValidationToken("a\r\nb")).toBeNull();
    expect(microsoftValidationToken("x".repeat(1001))).toBeNull();
    expect(microsoftValidationToken(null)).toBeNull();
  });
});

describe("handleMicrosoftNotifications", () => {
  it("keeps going when one notification fails", async () => {
    prisma.mailbox.findFirst.mockRejectedValueOnce(new Error("db blip")).mockResolvedValueOnce({ id: "mb2" });
    const out = await handleMicrosoftNotifications({ value: [note({ subscriptionId: "a" }), note({ subscriptionId: "b" })] }, now);
    expect(out.syncMailboxIds).toEqual(["mb2"]);
  });

  it("asks for a sync once per mailbox", async () => {
    const out = await handleMicrosoftNotifications({ value: [note(), note()] }, now);
    expect(out.syncMailboxIds).toEqual(["mb1"]);
    expect(prisma.mailbox.updateMany).toHaveBeenCalledWith({ where: { id: "mb1" }, data: { syncRequestedAt: now } });
    expect(verifyClientState).toHaveBeenCalledWith("mb1", "cs");
  });

  it("does nothing for a wrong clientState", async () => {
    verifyClientState.mockReturnValue(false);
    const out = await handleMicrosoftNotifications({ value: [note()] }, now);
    expect(out.syncMailboxIds).toEqual([]);
    expect(prisma.mailbox.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing for an unknown subscription or a malformed body", async () => {
    prisma.mailbox.findFirst.mockResolvedValue(null);
    expect((await handleMicrosoftNotifications({ value: [note()] }, now)).syncMailboxIds).toEqual([]);
    expect((await handleMicrosoftNotifications({ value: [{ subscriptionId: "s" }, null, 4] }, now)).syncMailboxIds).toEqual([]);
    expect((await handleMicrosoftNotifications(null, now)).syncMailboxIds).toEqual([]);
    expect((await handleMicrosoftNotifications({ value: "x" }, now)).syncMailboxIds).toEqual([]);
    expect(prisma.mailbox.updateMany).not.toHaveBeenCalled();
  });

  it("clears the expiry on reauthorization and removal so the tick renews", async () => {
    for (const lifecycleEvent of ["reauthorizationRequired", "subscriptionRemoved"]) {
      prisma.mailbox.updateMany.mockClear();
      const out = await handleMicrosoftNotifications({ value: [note({ lifecycleEvent })] }, now);
      expect(out.syncMailboxIds).toEqual([]);
      expect(prisma.mailbox.updateMany).toHaveBeenCalledWith({ where: { id: "mb1" }, data: { subscriptionExpiresAt: null } });
    }
  });

  it("flags a missed event for the next tick without syncing inline", async () => {
    const out = await handleMicrosoftNotifications({ value: [note({ lifecycleEvent: "missed" })] }, now);
    expect(out.syncMailboxIds).toEqual([]);
    expect(prisma.mailbox.updateMany).toHaveBeenCalledWith({ where: { id: "mb1" }, data: { syncRequestedAt: now } });
  });
});
