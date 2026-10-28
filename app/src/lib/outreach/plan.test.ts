import { beforeEach, describe, expect, it, vi } from "vitest";

const mailboxFindMany = vi.fn();
const messageCount = vi.fn();
const messageCreate = vi.fn();
const enrollmentFindMany = vi.fn();
const enrollmentUpdateMany = vi.fn();
const messageUpdateMany = vi.fn();
const messageFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    mailbox: { findMany: (...a: unknown[]) => mailboxFindMany(...a) },
    campaignMessage: {
      count: (...a: unknown[]) => messageCount(...a),
      create: (...a: unknown[]) => messageCreate(...a),
      updateMany: (...a: unknown[]) => messageUpdateMany(...a),
      findUnique: (...a: unknown[]) => messageFindUnique(...a),
    },
    campaignProspect: {
      findMany: (...a: unknown[]) => enrollmentFindMany(...a),
      updateMany: (...a: unknown[]) => enrollmentUpdateMany(...a),
    },
  },
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_DAILY_CAP_MAX: 50 }) }));
vi.mock("@/lib/closing/settings", () => ({
  getWorkspaceSettings: async () => ({ businessHourStart: 9, businessHourEnd: 18, businessDays: [1, 2, 3, 4, 5] }),
}));
const releaseCampaignLink = vi.fn();
vi.mock("./ownership", () => ({ releaseCampaignLink: (...a: unknown[]) => releaseCampaignLink(...a) }));

const { planEnrollments } = await import("./plan");

const now = new Date("2026-11-18T10:00:00Z"); // Wednesday 11:00 in Paris
const DAY = 86_400_000;
const mailbox = {
  id: "mb1",
  organizationId: "org",
  timezone: "Europe/Paris",
  rampStartedAt: now, // day 1 of the ramp: 5 a day
  dailyCap: 30,
  sentDay: null,
  sentCount: 0,
};
const step1 = { id: "s1", order: 1, delayDays: 0, subject: "Hello {{firstName|there}}", newThread: false, body: "Hi", carriesLink: false };
const step2 = { id: "s2", order: 2, delayDays: 3, subject: null, newThread: false, body: "Following up", carriesLink: false };
const person = {
  campaignId: "c1",
  organizationId: "org",
  email: "paul@acme.com",
  firstName: "Paul",
  lastName: null,
  company: "Acme",
  title: null,
  vars: null,
  timezone: "Europe/Paris",
  locale: "fr",
  status: "QUEUED",
  currentStep: 0,
  threadSubject: null,
  firstMessageId: null,
  linkId: null,
};

let queued: unknown[];
let stranded: unknown[];

beforeEach(() => {
  vi.clearAllMocks();
  queued = [];
  stranded = [];
  mailboxFindMany.mockResolvedValue([mailbox]);
  messageCount.mockResolvedValue(0);
  messageCreate.mockImplementation(async () => ({ id: "m-new" }));
  enrollmentUpdateMany.mockResolvedValue({ count: 1 });
  enrollmentFindMany.mockImplementation(async (args: { where: { status: string } }) =>
    args.where.status === "QUEUED" ? queued : stranded,
  );
});

describe("planEnrollments, first messages", () => {
  it("takes the allowance minus what is already scheduled today, oldest first", async () => {
    messageCount.mockResolvedValue(2);
    queued = [
      { ...person, id: "e1", campaign: { id: "c1", steps: [step1] } },
      { ...person, id: "e2", email: "ann@acme.com", campaign: { id: "c1", steps: [step1] } },
    ];
    const result = await planEnrollments(now);

    expect(messageCount).toHaveBeenCalledWith({
      where: { mailboxId: "mb1", status: "SCHEDULED", scheduledFor: { gte: expect.any(Date), lt: expect.any(Date) } },
    });
    const queuedCall = enrollmentFindMany.mock.calls.find(([a]) => a.where.status === "QUEUED")![0];
    expect(queuedCall.take).toBe(3); // 5 a day on day 1, 2 already planned
    expect(queuedCall.orderBy).toEqual({ createdAt: "asc" });
    expect(queuedCall.where).toEqual({ status: "QUEUED", campaign: { mailboxId: "mb1", status: "ACTIVE", steps: { some: { order: 1 } } } });
    expect(result.started).toBe(2);
  });

  it("moves each enrollment to ACTIVE once its first message is planned", async () => {
    queued = [{ ...person, id: "e1", campaign: { id: "c1", steps: [step1] } }];
    await planEnrollments(now);

    expect(messageCreate).toHaveBeenCalledTimes(1);
    const data = messageCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      campaignId: "c1",
      enrollmentId: "e1",
      mailboxId: "mb1",
      stepId: "s1",
      status: "SCHEDULED",
      dedupeKey: "cold:e1:s1",
      subject: "Hello Paul",
    });
    expect(data.scheduledFor.getTime()).toBeGreaterThan(now.getTime());
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "QUEUED" },
      data: { status: "ACTIVE", nextSendAt: data.scheduledFor },
    });
  });

  it("leaves everyone QUEUED when today is full", async () => {
    messageCount.mockResolvedValue(5);
    const result = await planEnrollments(now);
    expect(enrollmentFindMany.mock.calls.some(([a]) => a.where.status === "QUEUED")).toBe(false);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(result.started).toBe(0);
  });
});

describe("planEnrollments, catch-up", () => {
  const stuck = (extra: object) => ({
    ...person,
    id: "e1",
    status: "ACTIVE",
    campaign: { id: "c1", mailboxId: "mb1", steps: [step1, step2] },
    ...extra,
  });

  it("plans the next step of an enrollment with nothing pending", async () => {
    mailboxFindMany.mockResolvedValue([]);
    stranded = [stuck({ currentStep: 1, messages: [{ sentAt: new Date(now.getTime() - 4 * DAY) }] })];
    const result = await planEnrollments(now);

    expect(messageCreate.mock.calls[0][0].data).toMatchObject({ stepId: "s2", dedupeKey: "cold:e1:s2" });
    expect(result).toEqual({ started: 0, continued: 1, finished: 0 });
  });

  it("leaves the end of a linked enrollment to the reading evaluator, which has the signals", async () => {
    mailboxFindMany.mockResolvedValue([]);
    stranded = [stuck({ currentStep: 2, linkId: "l1", messages: [{ sentAt: new Date(now.getTime() - 5 * DAY) }] })];
    const result = await planEnrollments(now);
    expect(result.finished).toBe(0);
    expect(releaseCampaignLink).not.toHaveBeenCalled();
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({ where: { id: "e1", status: "ACTIVE" }, data: { nextSendAt: null } });
  });

  it("finishes the enrollment once the last step has had its time, and releases its link", async () => {
    mailboxFindMany.mockResolvedValue([]);
    stranded = [stuck({ currentStep: 2, linkId: null, messages: [{ sentAt: new Date(now.getTime() - 5 * DAY) }] })];
    const result = await planEnrollments(now);

    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "FINISHED", finishedAt: now },
    });
    expect(result.finished).toBe(1);
  });

  it("waits while the last step is still fresh", async () => {
    mailboxFindMany.mockResolvedValue([]);
    stranded = [stuck({ currentStep: 2, messages: [{ sentAt: new Date(now.getTime() - DAY) }] })];
    const result = await planEnrollments(now);
    expect(result).toEqual({ started: 0, continued: 0, finished: 0 });
    // Touched, so it moves to the back of the least-recently-updated order; nothing is due, so no nextSendAt
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { nextSendAt: null },
    });
  });

  it("skips enrollments waiting for a later time", async () => {
    mailboxFindMany.mockResolvedValue([]);
    await planEnrollments(now);
    const call = enrollmentFindMany.mock.calls.find(([a]) => a.where.status === "ACTIVE")![0];
    expect(call.where.OR).toEqual([{ nextSendAt: null }, { nextSendAt: { lte: now } }]);
  });

  it("restricts both passes to the beta workspaces", async () => {
    mailboxFindMany.mockResolvedValue([]);
    await planEnrollments(now, { organizationIds: ["org", "org2"] });
    expect(mailboxFindMany.mock.calls[0][0].where.organizationId).toEqual({ in: ["org", "org2"] });
    const call = enrollmentFindMany.mock.calls.find(([a]) => a.where.status === "ACTIVE")![0];
    expect(call.where.organizationId).toEqual({ in: ["org", "org2"] });
  });

  it.each([
    ["SENT", { currentStep: 2 }],
    ["FAILED", { status: "PAUSED", pausedReason: "send_failed", pausedAt: now }],
    ["CANCELLED", { status: "PAUSED", pausedReason: "send_failed", pausedAt: now }],
  ])("handles a next message that already exists as %s", async (existing, data) => {
    mailboxFindMany.mockResolvedValue([]);
    stranded = [stuck({ currentStep: 1, messages: [{ sentAt: new Date(now.getTime() - 4 * DAY) }] })];
    messageCreate.mockRejectedValue({ code: "P2002" });
    messageUpdateMany.mockResolvedValue({ count: 0 });
    messageFindUnique.mockResolvedValue({ id: "m-old", status: existing });
    const result = await planEnrollments(now);
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({ where: { id: "e1", status: "ACTIVE" }, data });
    expect(result.continued).toBe(0);
  });

  it("leaves it alone while the next message is still SCHEDULED", async () => {
    mailboxFindMany.mockResolvedValue([]);
    stranded = [stuck({ currentStep: 1, messages: [{ sentAt: new Date(now.getTime() - 4 * DAY) }] })];
    messageCreate.mockRejectedValue({ code: "P2002" });
    messageUpdateMany.mockResolvedValue({ count: 0 });
    messageFindUnique.mockResolvedValue({ id: "m-old", status: "SENDING" });
    await planEnrollments(now);
    expect(enrollmentUpdateMany).not.toHaveBeenCalled();
  });

  it("reads the catch-up least recently updated first", async () => {
    mailboxFindMany.mockResolvedValue([]);
    await planEnrollments(now);
    const call = enrollmentFindMany.mock.calls.find(([a]) => a.where.status === "ACTIVE")![0];
    expect(call.orderBy).toEqual({ updatedAt: "asc" });
  });
});
