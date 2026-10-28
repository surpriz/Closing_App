import { beforeEach, describe, expect, it, vi } from "vitest";

const messageFindMany = vi.fn();
const messageGroupBy = vi.fn();
const stepFindMany = vi.fn();
const campaignFindMany = vi.fn();
const enrollmentGroupBy = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    campaignMessage: {
      findMany: (...a: unknown[]) => messageFindMany(...a),
      groupBy: (...a: unknown[]) => messageGroupBy(...a),
    },
    campaignStep: { findMany: (...a: unknown[]) => stepFindMany(...a) },
    campaign: { findMany: (...a: unknown[]) => campaignFindMany(...a) },
    campaignProspect: { groupBy: (...a: unknown[]) => enrollmentGroupBy(...a) },
  },
}));

const { campaignMessageRow, getCampaignResults, getStepStats, stepKey } = await import("./results");
const now = new Date("2026-11-18T10:00:00Z");
const sentAt = new Date("2026-11-10T09:30:00Z");

const base = {
  kind: "STEP" as const,
  stepOrder: 1,
  followupTrigger: null,
  sentAt,
  timezone: "Europe/Paris",
  clickedAt: null,
  repliedAt: null,
  bouncedAt: null,
  meetingBookedAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  campaignFindMany.mockResolvedValue([]);
  enrollmentGroupBy.mockResolvedValue([]);
  messageGroupBy.mockResolvedValue([]);
});

describe("campaignMessageRow", () => {
  it("keys a step message by its order", () => {
    expect(stepKey(2)).toBe("step:2");
    expect(campaignMessageRow({ ...base, stepOrder: 2, clickedAt: sentAt })).toEqual({
      trigger: "step:2",
      goal: null,
      sentAt,
      timezone: "Europe/Paris",
      clickedAt: sentAt,
      repliedAt: null,
      bouncedAt: null,
      meetingBookedAt: null,
    });
  });
  it("keys an AI follow-up by its trigger", () => {
    const row = campaignMessageRow({ ...base, kind: "FOLLOWUP", stepOrder: null, followupTrigger: "COLD_READ" });
    expect(row?.trigger).toBe("COLD_READ");
  });
  it("is null without a step nor a trigger", () => {
    expect(campaignMessageRow({ ...base, stepOrder: null })).toBeNull();
    expect(campaignMessageRow({ ...base, kind: "FOLLOWUP", stepOrder: null })).toBeNull();
  });
});

function message(over: Record<string, unknown>) {
  return {
    kind: "STEP",
    stepId: "s1",
    campaignId: "c1",
    sentAt,
    clickedAt: null,
    repliedAt: null,
    bouncedAt: null,
    followup: null,
    enrollment: { timezone: "Europe/Paris", link: null },
    ...over,
  };
}

describe("getCampaignResults", () => {
  it("maps step ids to orders with one step query, and AI rows to their trigger", async () => {
    messageFindMany.mockResolvedValue([
      message({}),
      message({ repliedAt: sentAt }),
      message({ stepId: "s2" }),
      message({ kind: "FOLLOWUP", stepId: null, followup: { trigger: "COLD_READ" } }),
      message({ stepId: "gone" }),
    ]);
    stepFindMany.mockResolvedValue([
      { id: "s1", order: 1 },
      { id: "s2", order: 2 },
    ]);
    const result = await getCampaignResults("org1", null, now);
    expect(stepFindMany).toHaveBeenCalledTimes(1);
    expect(stepFindMany.mock.calls[0][0].where).toEqual({ campaignId: { in: ["c1"] } });
    expect(result.sent).toBe(4);
    expect(result.byStep).toEqual([
      { key: "step:1", sent: 2, clicked: 0, replied: 1, meetings: 0, bounced: 0 },
      { key: "COLD_READ", sent: 1, clicked: 0, replied: 0, meetings: 0, bounced: 0 },
      { key: "step:2", sent: 1, clicked: 0, replied: 0, meetings: 0, bounced: 0 },
    ]);
    // The message whose step is gone belongs to no row
    expect(result.byHour).toEqual([{ key: "10", sent: 4, clicked: 0, replied: 1, meetings: 0, bounced: 0 }]);
  });

  it("credits a meeting booked on the enrollment's link", async () => {
    messageFindMany.mockResolvedValue([
      message({ enrollment: { timezone: "Europe/Paris", link: { meetingBookedAt: new Date("2026-11-12T09:00:00Z") } } }),
    ]);
    stepFindMany.mockResolvedValue([{ id: "s1", order: 1 }]);
    const result = await getCampaignResults("org1", null, now);
    expect(result.byStep[0].meetings).toBe(1);
  });

  it("reads only SENT messages of the last 90 days in the workspace", async () => {
    messageFindMany.mockResolvedValue([]);
    const result = await getCampaignResults("org1", null, now);
    const where = messageFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("SENT");
    expect(where.campaign).toEqual({ organizationId: "org1" });
    expect(where.sentAt.gte).toEqual(new Date("2026-08-20T10:00:00Z"));
    expect(messageFindMany.mock.calls[0][0].take).toBe(5000);
    expect(stepFindMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, byStep: [], byHour: [], byCampaign: [] });
  });

  it("limits a seller to the campaigns they created", async () => {
    messageFindMany.mockResolvedValue([]);
    await getCampaignResults("org1", { userId: "u1", isOwner: true }, now);
    expect(messageFindMany.mock.calls[0][0].where.campaign).toEqual({ organizationId: "org1", createdById: "u1" });
    expect(campaignFindMany.mock.calls[0][0].where).toEqual({
      organizationId: "org1",
      createdById: "u1",
      status: { not: "ARCHIVED" },
    });
  });

  it("builds one line per live campaign from enrollments and messages", async () => {
    messageFindMany.mockResolvedValue([]);
    campaignFindMany.mockResolvedValue([
      { id: "c1", name: "Alpha", status: "ACTIVE" },
      { id: "c2", name: "Beta", status: "DRAFT" },
    ]);
    enrollmentGroupBy.mockResolvedValue([
      { campaignId: "c1", status: "ACTIVE", _count: { _all: 6 } },
      { campaignId: "c1", status: "REPLIED", _count: { _all: 3 } },
      { campaignId: "c1", status: "BOUNCED", _count: { _all: 1 } },
      { campaignId: "c1", status: "UNSUBSCRIBED", _count: { _all: 1 } },
    ]);
    messageGroupBy.mockResolvedValue([{ campaignId: "c1", _count: { _all: 20, clickedAt: 4 } }]);
    const result = await getCampaignResults("org1", null, now);
    expect(result.byCampaign).toEqual([
      { id: "c1", name: "Alpha", status: "ACTIVE", enrolled: 11, sent: 20, clicked: 4, replied: 3, bounced: 1, unsubscribed: 1 },
      { id: "c2", name: "Beta", status: "DRAFT", enrolled: 0, sent: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0 },
    ]);
  });
});

describe("getStepStats", () => {
  it("groups a campaign's whole life by step order, then by AI trigger", async () => {
    messageFindMany.mockResolvedValue([
      message({}),
      message({ stepId: "s2" }),
      message({ stepId: "s2", repliedAt: sentAt }),
      message({ kind: "FOLLOWUP", stepId: null, followup: { trigger: "COLD_READ" } }),
    ]);
    stepFindMany.mockResolvedValue([
      { id: "s1", order: 1 },
      { id: "s2", order: 2 },
    ]);
    const stats = await getStepStats("c1");
    expect(messageFindMany.mock.calls[0][0].where).toEqual({ campaignId: "c1", status: "SENT" });
    expect(stats.map((g) => [g.key, g.order, g.sent])).toEqual([
      ["step:1", 1, 1],
      ["step:2", 2, 2],
      ["COLD_READ", null, 1],
    ]);
  });
});
