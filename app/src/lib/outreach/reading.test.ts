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
  followupUpdateMany: vi.fn(),
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
    followup: { count: db.followupCount, updateMany: db.followupUpdateMany },
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

const { Prisma } = await import("@/generated/prisma/client");
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
    readEvaluatedAt: null,
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
  notifySeller.mockResolvedValue(true);
  db.followupUpdateMany.mockResolvedValue({ count: 1 });
  scheduleStepMessage.mockResolvedValue({ id: "m9" });
});

const updatesOf = () => db.enrollmentUpdateMany.mock.calls.map(([arg]) => arg);

describe("evaluateEnrollmentReading", () => {
  it("does nothing when the link has no enrollment, or the enrollment is over", async () => {
    db.linkFindUnique.mockResolvedValueOnce({ id: "l1", campaignProspectId: null });
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    enrollment.status = "FINISHED";
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    expect(db.enrollmentUpdateMany).not.toHaveBeenCalled();
    expect(notifySeller).not.toHaveBeenCalled();
  });

  it("applies nothing but stamps readEvaluatedAt when the campaign is not ACTIVE", async () => {
    (enrollment.campaign as { status: string }).status = "PAUSED";
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    expect(updatesOf()).toEqual([{ where: { id: "e1" }, data: { readEvaluatedAt: now } }]);
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

  it("is idempotent: when the alert and the follow-up were both deduplicated, nothing moves", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    queueFollowup.mockResolvedValue(null);
    notifySeller.mockResolvedValue(false);
    await evaluateEnrollmentReading("l1", now);
    expect(generateFollowupMessage).not.toHaveBeenCalled();
    expect(updatesOf()).toEqual([{ where: { id: "e1" }, data: { readEvaluatedAt: now } }]);
  });

  it("pauses when only the alert was new, or only the follow-up", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    queueFollowup.mockResolvedValue(null);
    await evaluateEnrollmentReading("l1", now);
    expect(updatesOf()[0].data).toMatchObject({ status: "PAUSED" });
    db.enrollmentUpdateMany.mockClear();
    notifySeller.mockResolvedValue(false);
    queueFollowup.mockResolvedValue("f2");
    await evaluateEnrollmentReading("l1", now);
    expect(updatesOf()[0].data).toMatchObject({ status: "PAUSED" });
  });

  it("with a follow-up already open, alerts and pauses but queues no second one", async () => {
    db.followupCount.mockResolvedValue(1);
    views = [view(), view({ startedAt: new Date(now.getTime() - 30 * MIN) })];
    await evaluateEnrollmentReading("l1", now);
    expect(notifySeller).toHaveBeenCalled();
    expect(queueFollowup).not.toHaveBeenCalled();
    expect(updatesOf()[0].data).toMatchObject({ status: "PAUSED", pausedReason: "deep_read" });
  });

  it("a pricing read replaces the open deep-read follow-up and moves the pause to call_moment", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "deep_read";
    enrollment.lastSignal = "deep";
    db.followupCount.mockResolvedValue(1);
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    expect(await evaluateEnrollmentReading("l1", now)).toBe("pause_alert");
    expect(db.followupUpdateMany).toHaveBeenCalledWith({
      where: { campaignProspectId: "e1", trigger: "COLD_READ", status: { in: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"] } },
      data: { status: "CANCELLED", cancelledAt: now, error: "Replaced by a newer analysis" },
    });
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_READ_PRICING" });
    expect(updatesOf()[0]).toEqual({
      where: { id: "e1", status: "PAUSED" },
      data: { lastSignal: "pricing", pausedReason: "call_moment" },
    });
  });

  it("a paused enrollment that already signalled the same kind queues nothing", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "deep_read";
    enrollment.lastSignal = "deep";
    views = [view(), view({ startedAt: new Date(now.getTime() - 30 * MIN) })];
    await evaluateEnrollmentReading("l1", now);
    expect(queueFollowup).not.toHaveBeenCalled();
    expect(notifySeller).not.toHaveBeenCalled();
    expect(updatesOf()).toEqual([{ where: { id: "e1" }, data: { readEvaluatedAt: now } }]);
  });

  it("leaves an enrollment paused for another reason alone", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "send_failed";
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    expect(notifySeller).not.toHaveBeenCalled();
    expect(queueFollowup).not.toHaveBeenCalled();
    expect(updatesOf()).toEqual([{ where: { id: "e1" }, data: { readEvaluatedAt: now } }]);
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

  it("forward: only stamps readEvaluatedAt, and the same forward is not news the next time", async () => {
    const forward = { createdAt: new Date(now.getTime() - 10 * MIN), toProspect: { email: "boss@acme.com" } };
    db.forwardFindMany.mockResolvedValue([forward]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("note_forward");
    expect(updatesOf()).toEqual([{ where: { id: "e1" }, data: { readEvaluatedAt: now } }]);
    expect(scheduleStepMessage).not.toHaveBeenCalled();

    enrollment.readEvaluatedAt = now;
    expect(await evaluateEnrollmentReading("l1", new Date(now.getTime() + 20 * MIN))).not.toBe("note_forward");
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

// The tagged template reaches the mock as (strings, ...values); nested fragments are flattened by Prisma.sql
const flat = (call: unknown[]) => Prisma.sql(call[0] as TemplateStringsArray, ...call.slice(1));

describe("evaluateReadingSignals", () => {
  it("evaluates the links of both passes once each and counts them", async () => {
    db.queryRaw.mockResolvedValueOnce([{ linkId: "l1" }, { linkId: "l2" }]).mockResolvedValueOnce([{ linkId: "l2" }, { linkId: "l3" }]);
    db.linkFindUnique.mockResolvedValue(null);
    expect(await evaluateReadingSignals(now, { organizationIds: ["org"] })).toBe(3);
    expect(db.linkFindUnique).toHaveBeenCalledTimes(3);
  });

  it("puts liveness, scope and the pause reasons in the SQL of the reading pass", async () => {
    db.queryRaw.mockResolvedValue([]);
    await evaluateReadingSignals(now, { organizationIds: ["org", "org2"], organizationId: "org" });
    const [reading, reactivation] = db.queryRaw.mock.calls.map(flat);
    expect(reading.sql).toContain(`c."status" = 'ACTIVE'`);
    expect(reading.sql).toContain(`o."suspendedAt" IS NULL`);
    expect(reading.sql).toContain(`"pausedReason" IN ('call_moment', 'deep_read')`);
    expect(reading.sql).toContain(`dv."isBot" = false`);
    expect(reading.values).toContain("org");
    expect(reading.values).not.toContain("org2");
    expect(reading.values).toContain(100);
    // second pass: ACTIVE, never reactivated, no step left, quiet for 5 days, not looked at today
    expect(reactivation.sql).toContain(`cp."reactivatedAt" IS NULL`);
    expect(reactivation.sql).toContain(`cp."currentStep" >= (SELECT COUNT(*)`);
    expect(reactivation.values).toEqual(
      expect.arrayContaining([new Date(now.getTime() - 5 * DAY), new Date(now.getTime() - DAY), "org", 50]),
    );
  });

  it("runs nothing for an empty beta list", async () => {
    db.queryRaw.mockResolvedValue([]);
    await evaluateReadingSignals(now, { organizationIds: [] });
    expect(flat(db.queryRaw.mock.calls[0]).sql).toContain("AND FALSE");
  });

  it("does nothing when no reading is waiting", async () => {
    db.queryRaw.mockResolvedValue([]);
    expect(await evaluateReadingSignals(now)).toBe(0);
    expect(db.linkFindUnique).not.toHaveBeenCalled();
  });

  it("keeps going when one enrollment throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.queryRaw.mockResolvedValueOnce([{ linkId: "l1" }, { linkId: "l2" }]).mockResolvedValueOnce([]);
    db.linkFindUnique.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(null);
    expect(await evaluateReadingSignals(now)).toBe(1);
  });
});
