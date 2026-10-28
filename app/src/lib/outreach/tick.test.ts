import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const mocks = vi.hoisted(() => ({
  expireStaleLeases: vi.fn(),
  syncMailboxesDue: vi.fn(),
  planEnrollments: vi.fn(),
  sendDueMessages: vi.fn(),
  finishIdleCampaigns: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("./sender", () => ({ expireStaleLeases: mocks.expireStaleLeases, sendDueMessages: mocks.sendDueMessages }));
vi.mock("@/lib/mailboxes/inbound/sync", () => ({ syncMailboxesDue: mocks.syncMailboxesDue }));
vi.mock("./plan", () => ({ planEnrollments: mocks.planEnrollments }));
vi.mock("./campaigns", () => ({ finishIdleCampaigns: mocks.finishIdleCampaigns }));

const { runOutreachTick } = await import("./tick");

const now = new Date("2026-10-28T10:00:00Z");

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
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

  it("forwards the scope and defaults the sync budget to 60s", async () => {
    await runOutreachTick(now, { organizationId: "org1" });
    expect(mocks.syncMailboxesDue).toHaveBeenCalledWith(now, { budgetMs: 60_000, organizationId: "org1" });
    expect(mocks.planEnrollments).toHaveBeenCalledWith(now, { organizationId: "org1" });
    expect(mocks.sendDueMessages).toHaveBeenCalledWith(now, { organizationId: "org1" });
    expect(mocks.finishIdleCampaigns).toHaveBeenCalledWith(now, { organizationId: "org1" });

    await runOutreachTick(now, { organizationId: "org1", syncBudgetMs: 5000 });
    expect(mocks.syncMailboxesDue).toHaveBeenLastCalledWith(now, { budgetMs: 5000, organizationId: "org1" });
  });
});
