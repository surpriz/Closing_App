import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const mocks = vi.hoisted(() => ({
  expireStaleLeases: vi.fn(),
  syncMailboxesDue: vi.fn(),
  planEnrollments: vi.fn(),
  sendDueMessages: vi.fn(),
  finishIdleCampaigns: vi.fn(),
  captureException: vi.fn(),
  orgIds: ["org1", "org2"] as string[],
}));

vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("./sender", () => ({ expireStaleLeases: mocks.expireStaleLeases, sendDueMessages: mocks.sendDueMessages }));
vi.mock("@/lib/mailboxes/inbound/sync", () => ({ syncMailboxesDue: mocks.syncMailboxesDue }));
vi.mock("./plan", () => ({ planEnrollments: mocks.planEnrollments }));
vi.mock("./campaigns", () => ({ finishIdleCampaigns: mocks.finishIdleCampaigns }));
vi.mock("./flag", () => ({ outreachOrgIds: () => mocks.orgIds }));

const { runOutreachTick } = await import("./tick");

const now = new Date("2026-10-28T10:00:00Z");

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.orgIds = ["org1", "org2"];
  vi.spyOn(console, "error").mockImplementation(() => {});
  const track = (name: string, value: unknown) =>
    vi.fn(async () => {
      calls.push(name);
      return value;
    });
  mocks.expireStaleLeases.mockImplementation(track("stale", { requeued: 1, failed: 0 }));
  mocks.syncMailboxesDue.mockImplementation(track("sync", { synced: 2, errors: 0 }));
  mocks.planEnrollments.mockImplementation(track("plan", { started: 3, continued: 0, finished: 0 }));
  mocks.sendDueMessages.mockImplementation(track("send", { sent: 4, rescheduled: 0, failed: 0, cancelled: 0 }));
  mocks.finishIdleCampaigns.mockImplementation(track("finish", 1));
});

describe("runOutreachTick", () => {
  it("runs the five steps in order and returns their results", async () => {
    const result = await runOutreachTick(now);
    expect(calls).toEqual(["stale", "sync", "plan", "send", "finish"]);
    expect(result).toEqual({
      stale: { requeued: 1, failed: 0 },
      synced: { synced: 2, errors: 0 },
      planned: { started: 3, continued: 0, finished: 0 },
      sent: { sent: 4, rescheduled: 0, failed: 0, cancelled: 0 },
      finished: 1,
    });
  });

  it("keeps going and logs when a step throws", async () => {
    const boom = new Error("imap down");
    mocks.syncMailboxesDue.mockRejectedValue(boom);
    const result = await runOutreachTick(now);
    expect(calls).toEqual(["stale", "plan", "send", "finish"]);
    expect(result.synced).toBeNull();
    expect(result.sent).not.toBeNull();
    expect(console.error).toHaveBeenCalledWith("[outreach:sync]", boom);
    expect(mocks.captureException).toHaveBeenCalledWith(boom, { tags: { outreach: "sync" } });
  });

  it("forwards the scope with the beta list and defaults the sync budget to 60s", async () => {
    await runOutreachTick(now, { organizationId: "org1" });
    const scope = { organizationId: "org1", organizationIds: ["org1", "org2"] };
    expect(mocks.expireStaleLeases).toHaveBeenCalledWith(now, scope);
    expect(mocks.syncMailboxesDue).toHaveBeenCalledWith(now, { budgetMs: 60_000, ...scope });
    expect(mocks.planEnrollments).toHaveBeenCalledWith(now, scope);
    expect(mocks.sendDueMessages).toHaveBeenCalledWith(now, scope);
    expect(mocks.finishIdleCampaigns).toHaveBeenCalledWith(now, scope);

    await runOutreachTick(now, { organizationId: "org1", syncBudgetMs: 5000 });
    expect(mocks.syncMailboxesDue).toHaveBeenLastCalledWith(now, { budgetMs: 5000, ...scope });
  });

  it("without a workspace, restricts every step to the beta list", async () => {
    await runOutreachTick(now);
    expect(mocks.planEnrollments).toHaveBeenCalledWith(now, { organizationIds: ["org1", "org2"] });
  });

  it("runs nothing when the list is empty or the workspace is not in it (kill switch)", async () => {
    mocks.orgIds = [];
    expect(await runOutreachTick(now)).toEqual({ stale: null, synced: null, planned: null, sent: null, finished: null });
    mocks.orgIds = ["org2"];
    await runOutreachTick(now, { organizationId: "org1" });
    expect(calls).toEqual([]);
  });

  it("fits the sync and the send in what is left before the deadline", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const deadline = new Date(now.getTime() + 30_000);
    await runOutreachTick(now, { deadline });
    expect(mocks.syncMailboxesDue).toHaveBeenCalledWith(now, { budgetMs: 30_000, organizationIds: ["org1", "org2"] });
    expect(mocks.sendDueMessages).toHaveBeenCalledWith(now, { organizationIds: ["org1", "org2"], deadline });

    await runOutreachTick(now, { deadline: new Date(now.getTime() + 600_000) });
    expect(mocks.syncMailboxesDue).toHaveBeenLastCalledWith(now, { budgetMs: 60_000, organizationIds: ["org1", "org2"] });
    vi.useRealTimers();
  });
});
