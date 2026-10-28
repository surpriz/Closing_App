import { beforeEach, describe, expect, it, vi } from "vitest";

import { MailboxError } from "../errors";
import type { InboundMessage, MailboxConnector } from "../types";

const prisma = {
  mailbox: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  member: { findMany: vi.fn() },
  campaignMessage: { findMany: vi.fn() },
  campaignProspect: { findMany: vi.fn() },
};
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("../index", () => ({ connectorFor: vi.fn() }));

const calls: string[] = [];
const handleInbound = vi.fn();
vi.mock("./handle", () => ({ handleInbound: (...a: unknown[]) => handleInbound(...a) }));
const notifyMailboxOwner = vi.fn();
vi.mock("../notify-owner", () => ({ notifyMailboxOwner: (...a: unknown[]) => notifyMailboxOwner(...a) }));

const { syncMailbox, syncMailboxesDue, MIN_SYNC_BUDGET_MS, SYNC_INTERVAL_MS, SYNC_INTERVAL_WEBHOOK_MS, SYNC_LEASE_MS, MAX_SYNC_BACKOFF_MS } =
  await import("./sync");

const NOW = new Date("2026-10-28T10:00:00Z");
const msg = (id: string) => ({ id }) as unknown as InboundMessage;
const row = {
  id: "mb1",
  organizationId: "org1",
  provider: "GENERIC",
  connector: "SMTP",
  email: "seller@acme.com",
  displayName: null,
  credentials: "x",
  status: "ACTIVE",
  timezone: "Europe/Paris",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  syncCursor: "c0",
  policyBounceDay: null,
  policyBounceCount: 0,
};

function fakeConnector(
  list: MailboxConnector["listNewMessages"],
  webhooks = false,
): MailboxConnector {
  return { capabilities: { webhooks }, listNewMessages: list } as unknown as MailboxConnector;
}

beforeEach(() => {
  vi.resetAllMocks();
  calls.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  prisma.mailbox.findUnique.mockResolvedValue(row);
  prisma.mailbox.update.mockImplementation(async (a: { data: { syncCursor?: string } }) => {
    if (a.data.syncCursor !== undefined) calls.push(`cursor:${a.data.syncCursor}`);
    return {};
  });
  prisma.member.findMany.mockResolvedValue([{ user: { email: "colleague@acme.com" } }]);
  prisma.campaignMessage.findMany.mockResolvedValue([{ id: "cm1", enrollmentId: "en1", messageId: "<Sent1@acme.com>" }]);
  prisma.campaignProspect.findMany.mockResolvedValue([
    { id: "en1", email: "Bob@target.io", messages: [{ sentAt: new Date("2026-10-27T10:00:00Z") }] },
    { id: "en2", email: "never@target.io", messages: [] },
  ]);
  handleInbound.mockImplementation(async (_m: unknown, m: InboundMessage) => {
    calls.push(`handle:${m.id}`);
    return "reply";
  });
});

describe("syncMailbox", () => {
  it("builds the match context, reads two pages and stores the cursor after each one", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ messages: [msg("a"), msg("b")], cursor: "c1", hasMore: true })
      .mockResolvedValueOnce({ messages: [msg("c")], cursor: "c2", hasMore: false });

    const result = await syncMailbox("mb1", NOW, { connector: () => fakeConnector(list) });

    expect(result?.pages).toBe(2);
    expect(result?.effects.reply).toBe(3);
    expect(calls).toEqual(["handle:a", "handle:b", "cursor:c1", "handle:c", "cursor:c2"]);
    expect(list.mock.calls[0][0]).toBe("c0");
    expect(list.mock.calls[1][0]).toBe("c1");
    const opts = list.mock.calls[0][1];
    expect(opts.limit).toBe(50);
    // 7 days back: the mailbox is older than the lookback
    expect(opts.notBefore).toEqual(new Date(NOW.getTime() - 7 * 86_400_000));
    expect([...opts.candidateSenders]).toEqual(["bob@target.io"]);
    const ctx = handleInbound.mock.calls[0][2];
    expect(ctx.teamEmails).toEqual(["colleague@acme.com"]);
    expect(ctx.sentMessageIds.get("sent1@acme.com")).toEqual({ enrollmentId: "en1", messageId: "cm1" });
    expect(ctx.enrollments).toEqual([
      { enrollmentId: "en1", email: "Bob@target.io", lastSentAt: new Date("2026-10-27T10:00:00Z") },
    ]);
  });

  it("does not look further back than the mailbox exists", async () => {
    const created = new Date(NOW.getTime() - 86_400_000);
    prisma.mailbox.findUnique.mockResolvedValue({ ...row, createdAt: created });
    const list = vi.fn().mockResolvedValue({ messages: [], cursor: "c0", hasMore: false });
    await syncMailbox("mb1", NOW, { connector: () => fakeConnector(list) });
    expect(list.mock.calls[0][1].notBefore).toEqual(created);
  });

  it("a throwing effect leaves the cursor at the previous page and the sync fails", async () => {
    handleInbound.mockResolvedValueOnce("reply").mockRejectedValueOnce(new Error("db blip"));
    const list = vi
      .fn()
      .mockResolvedValueOnce({ messages: [msg("a")], cursor: "c1", hasMore: true })
      .mockResolvedValueOnce({ messages: [msg("b"), msg("c")], cursor: "c2", hasMore: false });
    await expect(syncMailbox("mb1", NOW, { connector: () => fakeConnector(list) })).rejects.toThrow("db blip");
    expect(calls).toEqual(["cursor:c1"]);
    expect(handleInbound).toHaveBeenCalledTimes(2);
  });

  it("stops cleanly when the budget runs out between pages, keeping the first cursor", async () => {
    const list = vi
      .fn()
      .mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 25));
        return { messages: [msg("a")], cursor: "c1", hasMore: true };
      })
      .mockResolvedValue({ messages: [msg("z")], cursor: "c2", hasMore: false });

    const result = await syncMailbox("mb1", NOW, { connector: () => fakeConnector(list), budgetMs: 5 });

    expect(result?.pages).toBe(1);
    expect(list).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["handle:a", "cursor:c1"]);
  });

  it("skips a mailbox that is no longer active", async () => {
    prisma.mailbox.findUnique.mockResolvedValue({ ...row, status: "ERROR" });
    expect(await syncMailbox("mb1", NOW, { connector: () => fakeConnector(vi.fn()) })).toBeNull();
  });
});

describe("syncMailboxesDue", () => {
  const due = (over: object = {}) => ({ ...row, syncErrorCount: 0, ...over });
  const okList = () => vi.fn().mockResolvedValue({ messages: [], cursor: "c1", hasMore: false });
  const lastUpdate = () => prisma.mailbox.updateMany.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    prisma.mailbox.findMany.mockResolvedValue([due()]);
    prisma.mailbox.updateMany.mockResolvedValue({ count: 1 });
  });

  it("asks for the right mailboxes and claims each with a lease", async () => {
    await syncMailboxesDue(NOW, { budgetMs: 60_000, organizationId: "org1", connector: () => fakeConnector(okList()) });
    const query = prisma.mailbox.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({
      status: "ACTIVE",
      organizationId: "org1",
      organization: { suspendedAt: null },
      messages: { some: { status: "SENT", sentAt: { gte: new Date(NOW.getTime() - 60 * 86_400_000) } } },
      OR: [{ syncRequestedAt: { not: null } }, { nextSyncAt: null }, { nextSyncAt: { lte: NOW } }],
    });
    expect(query.orderBy).toEqual([{ syncRequestedAt: "asc" }, { nextSyncAt: { sort: "asc", nulls: "first" } }]);
    expect(query.take).toBe(20);
    expect(prisma.mailbox.updateMany).toHaveBeenCalledWith({
      where: {
        id: "mb1",
        OR: [{ syncClaimedAt: null }, { syncClaimedAt: { lt: new Date(NOW.getTime() - SYNC_LEASE_MS) } }],
      },
      data: { syncClaimedAt: NOW, syncRequestedAt: null },
    });
  });

  it("only looks at the beta workspaces of the kill switch list", async () => {
    await syncMailboxesDue(NOW, { budgetMs: 60_000, organizationIds: ["org1", "org2"], connector: () => fakeConnector(okList()) });
    expect(prisma.mailbox.findMany.mock.calls[0][0].where.organizationId).toEqual({ in: ["org1", "org2"] });
  });

  it("schedules the next pass 5 minutes out, 15 with webhooks, and clears errors and lease", async () => {
    prisma.mailbox.findMany.mockResolvedValue([due({ syncErrorCount: 2 })]);
    expect(await syncMailboxesDue(NOW, { budgetMs: 60_000, connector: () => fakeConnector(okList()) })).toEqual({
      synced: 1,
      errors: 0,
    });
    expect(lastUpdate()).toEqual({
      where: { id: "mb1", syncClaimedAt: NOW },
      data: { lastSyncAt: NOW, nextSyncAt: new Date(NOW.getTime() + SYNC_INTERVAL_MS), syncErrorCount: 0, syncClaimedAt: null },
    });

    await syncMailboxesDue(NOW, { budgetMs: 60_000, connector: () => fakeConnector(okList(), true) });
    expect(lastUpdate().data.nextSyncAt).toEqual(new Date(NOW.getTime() + SYNC_INTERVAL_WEBHOOK_MS));
  });

  it("skips a mailbox whose lease is held elsewhere", async () => {
    prisma.mailbox.updateMany.mockResolvedValue({ count: 0 });
    const list = okList();
    expect(await syncMailboxesDue(NOW, { budgetMs: 60_000, connector: () => fakeConnector(list) })).toEqual({
      synced: 0,
      errors: 0,
    });
    expect(list).not.toHaveBeenCalled();
    expect(prisma.mailbox.updateMany).toHaveBeenCalledTimes(1); // the refused lease only
  });

  it("a revoked login puts the mailbox in error, backs off and tells the owner", async () => {
    const list = vi.fn().mockRejectedValue(new MailboxError("AUTH_REVOKED", "login refused", { detail: "invalid_grant" }));
    const result = await syncMailboxesDue(NOW, { budgetMs: 60_000, connector: () => fakeConnector(list) });
    expect(result).toEqual({ synced: 0, errors: 1 });
    expect(lastUpdate()).toEqual({
      where: { id: "mb1", syncClaimedAt: NOW },
      data: {
        syncErrorCount: 1,
        nextSyncAt: new Date(NOW.getTime() + SYNC_INTERVAL_MS * 2),
        syncClaimedAt: null,
        lastError: "AUTH_REVOKED: invalid_grant",
        lastErrorAt: NOW,
        status: "ERROR",
      },
    });
    expect(notifyMailboxOwner).toHaveBeenCalledWith("mb1", "auth_revoked", "invalid_grant", NOW);
  });

  it("caps the backoff and warns the owner on the 3rd consecutive failure", async () => {
    prisma.mailbox.findMany.mockResolvedValue([due({ syncErrorCount: 2 })]);
    const list = vi.fn().mockRejectedValue(new MailboxError("TRANSIENT", "timeout"));
    await syncMailboxesDue(NOW, { budgetMs: 60_000, connector: () => fakeConnector(list) });
    expect(lastUpdate().data).toMatchObject({ syncErrorCount: 3, lastError: "TRANSIENT: timeout" });
    expect(lastUpdate().data.status).toBeUndefined();
    expect(lastUpdate().data.nextSyncAt).toEqual(new Date(NOW.getTime() + SYNC_INTERVAL_MS * 8));
    expect(notifyMailboxOwner).toHaveBeenCalledWith("mb1", "sync_failed", "timeout", NOW);

    prisma.mailbox.findMany.mockResolvedValue([due({ syncErrorCount: 9 })]);
    await syncMailboxesDue(NOW, { budgetMs: 60_000, connector: () => fakeConnector(list) });
    expect(lastUpdate().data.nextSyncAt).toEqual(new Date(NOW.getTime() + MAX_SYNC_BACKOFF_MS));
  });

  it("does not warn before the 3rd failure, and one broken mailbox does not stop the next", async () => {
    prisma.mailbox.findMany.mockResolvedValue([due({ id: "bad" }), due({ id: "good" })]);
    prisma.mailbox.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ ...row, id: where.id }));
    const connector = (m: { id: string }) =>
      m.id === "bad" ? fakeConnector(vi.fn().mockRejectedValue(new Error("weird"))) : fakeConnector(okList());
    const result = await syncMailboxesDue(NOW, { budgetMs: 60_000, connector });
    expect(result).toEqual({ synced: 1, errors: 1 });
    expect(notifyMailboxOwner).not.toHaveBeenCalled();
    const bad = prisma.mailbox.updateMany.mock.calls.find((c) => c[0].where.id === "bad" && c[0].data.lastError)?.[0];
    expect(bad.data.lastError).toBe("TRANSIENT: weird");
  });

  it("does not start a mailbox when too little budget is left", async () => {
    const list = okList();
    const result = await syncMailboxesDue(NOW, { budgetMs: MIN_SYNC_BUDGET_MS - 1, connector: () => fakeConnector(list) });
    expect(result).toEqual({ synced: 0, errors: 0 });
    expect(prisma.mailbox.updateMany).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  const abortingList = () =>
    vi.fn().mockImplementation(
      (_c: unknown, o: { signal: AbortSignal }) =>
        new Promise((_, reject) => o.signal.addEventListener("abort", () => reject(new Error("aborted")))),
    );

  it("a mailbox cut short at the tail of the tick goes to the back of the line, without a failure", async () => {
    // Date too: on the real clock any millisecond spent before the first mailbox leaves less than MIN_SYNC_BUDGET_MS,
    // and the tick skips it instead of syncing it
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const run = syncMailboxesDue(NOW, { budgetMs: MIN_SYNC_BUDGET_MS, connector: () => fakeConnector(abortingList()) });
      await vi.advanceTimersByTimeAsync(MIN_SYNC_BUDGET_MS);
      expect(await run).toEqual({ synced: 0, errors: 0 });
    } finally {
      vi.useRealTimers();
    }
    expect(prisma.mailbox.updateMany).toHaveBeenCalledTimes(2);
    expect(lastUpdate()).toEqual({
      where: { id: "mb1", syncClaimedAt: NOW },
      data: { syncClaimedAt: null, nextSyncAt: new Date(NOW.getTime() + 60_000) },
    });
    expect(notifyMailboxOwner).not.toHaveBeenCalled();
  });

  it("a mailbox that gets no page within a full budget counts as a soft failure and backs off", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const run = syncMailboxesDue(NOW, { budgetMs: 60_000, connector: () => fakeConnector(abortingList()) });
      await vi.advanceTimersByTimeAsync(25_000);
      expect(await run).toEqual({ synced: 0, errors: 1 });
    } finally {
      vi.useRealTimers();
    }
    expect(lastUpdate()).toEqual({
      where: { id: "mb1", syncClaimedAt: NOW },
      data: {
        syncErrorCount: 1,
        nextSyncAt: new Date(NOW.getTime() + SYNC_INTERVAL_MS * 2),
        syncClaimedAt: null,
        lastError: "TRANSIENT: no page within budget",
        lastErrorAt: NOW,
      },
    });
  });
});
