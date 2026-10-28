import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  linkFindUnique: vi.fn(),
  enrollmentFindUnique: vi.fn(),
  enrollmentFindMany: vi.fn(),
  enrollmentUpdateMany: vi.fn(),
  viewFindMany: vi.fn(),
  forwardFindMany: vi.fn(),
  messageFindMany: vi.fn(),
  followupCount: vi.fn(),
  prospectFindFirst: vi.fn(),
  queryRaw: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    link: { findUnique: db.linkFindUnique },
    campaignProspect: {
      findUnique: db.enrollmentFindUnique,
      findMany: db.enrollmentFindMany,
      updateMany: db.enrollmentUpdateMany,
    },
    documentView: { findMany: db.viewFindMany },
    linkForward: { findMany: db.forwardFindMany },
    campaignMessage: { findMany: db.messageFindMany },
    followup: { count: db.followupCount },
    prospect: { findFirst: db.prospectFindFirst },
    $queryRaw: db.queryRaw,
  },
}));
const readingOfLink = vi.fn();
vi.mock("@/lib/closing/shared/reading-time", () => ({ readingOfLink: (...a: unknown[]) => readingOfLink(...a) }));
vi.mock("@/lib/closing/settings", () => ({
  getWorkspaceSettings: async () => ({
    businessHourStart: 9,
    businessHourEnd: 18,
    businessDays: [1, 2, 3, 4, 5],
    minDelayAfterReadingHours: 3,
    maxFollowupsPer30Days: 3,
    minDaysBetweenFollowups: 3,
    hotPricingThresholdSec: 30,
  }),
}));
const queueFollowup = vi.fn();
const generateFollowupMessage = vi.fn();
vi.mock("@/lib/closing/followups/queue", () => ({
  OPEN_FOLLOWUP_STATUSES: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"],
  queueFollowup: (...a: unknown[]) => queueFollowup(...a),
  generateFollowupMessage: (...a: unknown[]) => generateFollowupMessage(...a),
  isUniqueViolation: () => false,
}));
const notifySeller = vi.fn();
vi.mock("@/lib/closing/notify/notify", () => ({ notifySeller: (...a: unknown[]) => notifySeller(...a) }));
vi.mock("@/lib/closing/scheduling/send-time", async () => ({
  habitualSendHour: async () => null,
  nextSendSlot: (await vi.importActual<typeof import("@/lib/closing/scheduling/send-slot")>("@/lib/closing/scheduling/send-slot"))
    .nextSendSlot,
}));
const scheduleStepMessage = vi.fn();
vi.mock("./messages", async () => ({
  ...(await vi.importActual<typeof import("./messages")>("./messages")),
  scheduleStepMessage: (...a: unknown[]) => scheduleStepMessage(...a),
}));
const releaseCampaignLink = vi.fn();
vi.mock("./ownership", () => ({ releaseCampaignLink: (...a: unknown[]) => releaseCampaignLink(...a) }));

const { evaluateEnrollmentReading, evaluateReadingSignals } = await import("./reading");

const now = new Date("2026-11-18T10:00:00Z"); // Wednesday 11:00 in Paris
const MIN = 60_000;
const DAY = 86_400_000;
const step1 = { id: "s1", order: 1, delayDays: 0, subject: "Hi", newThread: false, body: "Hi", carriesLink: true };
const step2 = { id: "s2", order: 2, delayDays: 3, subject: null, newThread: false, body: "News?", carriesLink: false };

let enrollment: Record<string, unknown>;
let views: object[];

const view = (extra: object = {}) => ({
  startedAt: new Date(now.getTime() - 60 * MIN),
  lastSeenAt: new Date(now.getTime() - 50 * MIN),
  isBot: false,
  totalDurationMs: 10_000,
  maxPageReached: 1,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  enrollment = {
    id: "e1",
    organizationId: "org",
    email: "paul@acme.com",
    firstName: "Paul",
    lastName: null,
    company: "Acme",
    title: null,
    vars: null,
    timezone: "Europe/Paris",
    locale: "fr",
    status: "ACTIVE",
    currentStep: 1,
    threadSubject: null,
    firstMessageId: null,
    linkId: "l1",
    prospectId: "p1",
    campaignId: "c1",
    repliedAt: null,
    lastSignal: null,
    reactivatedAt: null,
    pausedReason: null,
    campaign: { id: "c1", status: "ACTIVE", mailboxId: "mb1", steps: [step1, step2] },
  };
  views = [view()];
  db.linkFindUnique.mockResolvedValue({
    id: "l1",
    documentId: "d1",
    campaignProspectId: "e1",
    createdBy: { locale: "en" },
    document: { numPages: 10 },
    engagementScore: null,
  });
  db.enrollmentFindUnique.mockImplementation(async () => enrollment);
  db.enrollmentUpdateMany.mockResolvedValue({ count: 1 });
  db.viewFindMany.mockImplementation(async () => views);
  db.forwardFindMany.mockResolvedValue([]);
  db.messageFindMany.mockResolvedValue([{ sentAt: new Date(now.getTime() - 5 * DAY), kind: "STEP" }]);
  db.followupCount.mockResolvedValue(0);
  db.prospectFindFirst.mockResolvedValue({ id: "p1", timezone: null });
  readingOfLink.mockResolvedValue({ readingMs: 10_000, pricingMs: 0, tags: [] });
  queueFollowup.mockResolvedValue("f1");
  scheduleStepMessage.mockResolvedValue({ id: "m9" });
});

const updatesOf = () => db.enrollmentUpdateMany.mock.calls.map(([arg]) => arg);

describe("evaluateEnrollmentReading", () => {
  it("does nothing when the link has no enrollment, or the campaign is not ACTIVE", async () => {
    db.linkFindUnique.mockResolvedValueOnce({ id: "l1", campaignProspectId: null });
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    (enrollment.campaign as { status: string }).status = "PAUSED";
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    enrollment.status = "FINISHED";
    (enrollment.campaign as { status: string }).status = "ACTIVE";
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    expect(db.enrollmentUpdateMany).not.toHaveBeenCalled();
    expect(notifySeller).not.toHaveBeenCalled();
  });

  it("pricing: pauses, alerts the seller, queues the pricing follow-up for the next morning", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: ["PRICING"] });
    expect(await evaluateEnrollmentReading("l1", now)).toBe("pause_alert");

    expect(updatesOf()).toContainEqual({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "call_moment", pausedAt: now, lastSignal: "pricing" },
    });
    expect(notifySeller).toHaveBeenCalledWith({
      linkId: "l1",
      type: "CALL_MOMENT",
      dedupeKey: "cold_call:l1:call_moment",
      payload: { reason: "Lingering on the pricing (cold campaign)" },
      now,
    });
    const queued = queueFollowup.mock.calls[0][0];
    expect(queued).toMatchObject({
      linkId: "l1",
      prospectId: "p1",
      trigger: "COLD_READ_PRICING",
      channel: "EMAIL",
      timezone: "Europe/Paris",
      locale: "fr",
      dedupeKey: "cold:e1:read:pricing",
      context: { readTags: ["PRICING"], campaignProspectId: "e1" },
      campaignProspectId: "e1",
    });
    expect(queued.scheduledFor.getTime()).toBeGreaterThan(now.getTime() + 12 * 3_600_000); // not today
    expect(generateFollowupMessage).toHaveBeenCalledWith("f1");
    expect(updatesOf().at(-1)).toEqual({ where: { id: "e1" }, data: { readEvaluatedAt: now } });
  });

  it("deep read: pauses with deep_read and queues COLD_READ", async () => {
    views = [view(), view({ startedAt: new Date(now.getTime() - 30 * MIN) })];
    expect(await evaluateEnrollmentReading("l1", now)).toBe("pause_alert");
    expect(updatesOf()[0].data).toMatchObject({ pausedReason: "deep_read", lastSignal: "deep" });
    expect(notifySeller.mock.calls[0][0].dedupeKey).toBe("cold_call:l1:deep_read");
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_READ", dedupeKey: "cold:e1:read:deep" });
  });

  it("is idempotent: a follow-up that already exists is not generated twice", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    queueFollowup.mockResolvedValue(null);
    await evaluateEnrollmentReading("l1", now);
    expect(queueFollowup).toHaveBeenCalledTimes(1);
    expect(generateFollowupMessage).not.toHaveBeenCalled();
  });

  it("an enrollment paused by a reading only gets its lastSignal moved by a stronger signal", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "deep_read";
    enrollment.lastSignal = "deep";
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    expect(await evaluateEnrollmentReading("l1", now)).toBe("pause_alert");
    expect(updatesOf()[0]).toEqual({ where: { id: "e1", status: "PAUSED" }, data: { lastSignal: "pricing" } });
  });

  it("leaves an enrollment paused for another reason alone", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "send_failed";
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    expect(notifySeller).not.toHaveBeenCalled();
    expect(queueFollowup).not.toHaveBeenCalled();
  });

  it("reactivation: queues COLD_REACTIVATE asap and stamps reactivatedAt", async () => {
    enrollment.currentStep = 2; // no step left
    enrollment.lastSignal = null;
    views = [view({ lastSeenAt: new Date(now.getTime() - 8 * DAY), startedAt: new Date(now.getTime() - 8 * DAY) })];
    db.messageFindMany.mockResolvedValue([{ sentAt: new Date(now.getTime() - 9 * DAY), kind: "STEP" }]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("ai_followup");
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_REACTIVATE", dedupeKey: "cold:e1:read:reactivate" });
    expect(updatesOf()).toContainEqual({
      where: { id: "e1", status: "ACTIVE" },
      data: { reactivatedAt: now, lastSignal: "reactivate" },
    });
  });

  it("forward: notes it and keeps the calendar", async () => {
    db.forwardFindMany.mockResolvedValue([{ toProspect: { email: "boss@acme.com" } }]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("note_forward");
    expect(updatesOf()[0]).toEqual({ where: { id: "e1", status: "ACTIVE" }, data: { lastSignal: "forward" } });
    expect(scheduleStepMessage).not.toHaveBeenCalled();
  });

  it("a skim only moves the next step after the reading delay", async () => {
    views = [view({ lastSeenAt: new Date(now.getTime() - 20 * MIN) })];
    expect(await evaluateEnrollmentReading("l1", now)).toBe("send_step");
    const input = scheduleStepMessage.mock.calls[0][0];
    expect(input).toMatchObject({ campaignId: "c1", mailboxId: "mb1", step: { id: "s2" } });
    // read 20 min ago, delay 3h: not before 12:40 UTC
    expect(input.scheduledFor.getTime()).toBeGreaterThanOrEqual(now.getTime() + 2 * 3_600_000);
    expect(updatesOf()).toContainEqual({
      where: { id: "e1", status: "ACTIVE" },
      data: { nextSendAt: input.scheduledFor },
    });
    expect(updatesOf().at(-1)).toEqual({ where: { id: "e1" }, data: { readEvaluatedAt: now } });
  });

  it("finish: ends the sequence and releases the link", async () => {
    enrollment.currentStep = 2;
    views = [];
    db.messageFindMany.mockResolvedValue([{ sentAt: new Date(now.getTime() - 5 * DAY), kind: "STEP" }]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("finish");
    expect(updatesOf()[0]).toEqual({ where: { id: "e1", status: "ACTIVE" }, data: { status: "FINISHED", finishedAt: now } });
    expect(releaseCampaignLink).toHaveBeenCalledWith("l1");
  });

  it("does not finish while a campaign follow-up is open", async () => {
    enrollment.currentStep = 2;
    views = [];
    db.followupCount.mockResolvedValue(1);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("wait");
    expect(releaseCampaignLink).not.toHaveBeenCalled();
  });
});

describe("evaluateReadingSignals", () => {
  it("evaluates the links the query returns, within the scope, and counts them", async () => {
    db.queryRaw.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    db.enrollmentFindMany.mockResolvedValue([{ linkId: "l1" }, { linkId: "l2" }]);
    db.linkFindUnique.mockResolvedValue(null);
    expect(await evaluateReadingSignals(now, { organizationIds: ["org"] })).toBe(2);
    expect(db.enrollmentFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["e1", "e2"] },
        organizationId: { in: ["org"] },
        campaign: { status: "ACTIVE", organization: { suspendedAt: null } },
        linkId: { not: null },
      },
      select: { linkId: true },
      take: 100,
    });
    expect(db.linkFindUnique).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no reading is waiting", async () => {
    db.queryRaw.mockResolvedValue([]);
    expect(await evaluateReadingSignals(now)).toBe(0);
    expect(db.enrollmentFindMany).not.toHaveBeenCalled();
  });

  it("keeps going when one enrollment throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.queryRaw.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    db.enrollmentFindMany.mockResolvedValue([{ linkId: "l1" }, { linkId: "l2" }]);
    db.linkFindUnique.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(null);
    expect(await evaluateReadingSignals(now)).toBe(1);
  });
});
