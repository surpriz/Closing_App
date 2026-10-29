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
  followupFindMany: vi.fn(),
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
    followup: { count: db.followupCount, updateMany: db.followupUpdateMany, findMany: db.followupFindMany },
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
const orgIds = vi.hoisted(() => ({ value: ["org"] as string[] }));
vi.mock("./flag", () => ({ outreachOrgIds: () => orgIds.value }));
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

// Two sessions that add up to more than a skim: a reread
const reread = () => {
  views = [view(), view({ startedAt: new Date(now.getTime() - 30 * MIN) })];
  readingOfLink.mockResolvedValue({ readingMs: 60_000, pricingMs: 0, tags: [] });
};

beforeEach(() => {
  vi.clearAllMocks();
  orgIds.value = ["org"];
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
    campaign: { id: "c1", status: "ACTIVE", mailboxId: "mb1", organization: { suspendedAt: null }, steps: [step1, step2] },
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
  db.followupFindMany.mockResolvedValue([{ trigger: "COLD_READ" }]);
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

  it("applies nothing and leaves the reading unevaluated when the campaign is not ACTIVE", async () => {
    (enrollment.campaign as { status: string }).status = "PAUSED";
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    // Not stamped: once the campaign resumes, the catch-up still sees this reading
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
    reread();
    expect(await evaluateEnrollmentReading("l1", now)).toBe("pause_alert");
    expect(updatesOf()[0].data).toMatchObject({ pausedReason: "deep_read", lastSignal: "deep" });
    expect(notifySeller.mock.calls[0][0].dedupeKey).toBe("cold_call:l1:deep_read");
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_READ", dedupeKey: "cold:e1:read:deep" });
  });

  it("writes the pause before the effects, and keeps it when both turn out deduplicated", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    queueFollowup.mockResolvedValue(null);
    notifySeller.mockResolvedValue(false);
    await evaluateEnrollmentReading("l1", now);
    expect(generateFollowupMessage).not.toHaveBeenCalled();
    expect(updatesOf()[0]).toEqual({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "call_moment", pausedAt: now, lastSignal: "pricing" },
    });
    const paused = db.enrollmentUpdateMany.mock.invocationCallOrder[0];
    expect(paused).toBeLessThan(notifySeller.mock.invocationCallOrder[0]);
    expect(paused).toBeLessThan(queueFollowup.mock.invocationCallOrder[0]);
  });

  it("at the 30-day follow-up cap, alerts and records the signal without pausing", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    db.messageFindMany.mockResolvedValue([
      { sentAt: new Date(now.getTime() - 20 * DAY), kind: "STEP" },
      { sentAt: new Date(now.getTime() - 15 * DAY), kind: "FOLLOWUP" },
      { sentAt: new Date(now.getTime() - 10 * DAY), kind: "FOLLOWUP" },
      { sentAt: new Date(now.getTime() - 5 * DAY), kind: "FOLLOWUP" },
    ]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("pause_alert");
    expect(notifySeller).toHaveBeenCalled();
    expect(queueFollowup).not.toHaveBeenCalled();
    expect(updatesOf()[0]).toEqual({ where: { id: "e1", status: "ACTIVE" }, data: { lastSignal: "pricing" } });
    expect(updatesOf().some((u) => u.data.status === "PAUSED")).toBe(false);
  });

  it("fixed steps do not use up the 30-day cap", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    db.messageFindMany.mockResolvedValue([1, 2, 3, 4].map((d) => ({ sentAt: new Date(now.getTime() - d * 4 * DAY), kind: "STEP" })));
    await evaluateEnrollmentReading("l1", now);
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_READ_PRICING" });
    expect(updatesOf()[0].data).toMatchObject({ status: "PAUSED" });
  });

  it("does not read, nor stamp, outside the beta or for a suspended workspace", async () => {
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    orgIds.value = [];
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    orgIds.value = ["org"];
    (enrollment.campaign as { organization: { suspendedAt: Date | null } }).organization.suspendedAt = now;
    expect(await evaluateEnrollmentReading("l1", now)).toBeNull();
    expect(db.enrollmentUpdateMany).not.toHaveBeenCalled();
    expect(notifySeller).not.toHaveBeenCalled();
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
    reread();
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
      where: { campaignProspectId: "e1", status: { in: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"] } },
      data: { status: "CANCELLED", cancelledAt: now, error: "Replaced by a newer analysis" },
    });
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_READ_PRICING" });
    expect(updatesOf()[0]).toEqual({
      where: { id: "e1", status: "PAUSED" },
      data: { lastSignal: "pricing", pausedReason: "call_moment" },
    });
  });

  it("no upgrade when the open follow-up already is the pricing one: it stays, nothing is cancelled", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "deep_read";
    enrollment.lastSignal = "deep";
    db.followupCount.mockResolvedValue(1);
    db.followupFindMany.mockResolvedValue([{ trigger: "COLD_READ_PRICING" }]);
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    await evaluateEnrollmentReading("l1", now);
    expect(db.followupUpdateMany).not.toHaveBeenCalled();
    expect(queueFollowup).not.toHaveBeenCalled();
    expect(updatesOf()[0]).toEqual({
      where: { id: "e1", status: "PAUSED" },
      data: { lastSignal: "pricing", pausedReason: "call_moment" },
    });
  });

  it("a paused enrollment that already signalled the same kind queues nothing", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "deep_read";
    enrollment.lastSignal = "deep";
    reread();
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
    // Not stamped either: the reading is evaluated once the seller resumes it
    expect(db.enrollmentUpdateMany).not.toHaveBeenCalled();
  });

  it("reactivation: queues COLD_REACTIVATE asap and stamps reactivatedAt", async () => {
    enrollment.currentStep = 2; // no step left
    enrollment.lastSignal = null;
    views = [view({ lastSeenAt: new Date(now.getTime() - 8 * DAY), startedAt: new Date(now.getTime() - 8 * DAY) })];
    db.messageFindMany.mockResolvedValue([{ sentAt: new Date(now.getTime() - 9 * DAY), kind: "STEP" }]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("ai_followup");
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_REACTIVATE", dedupeKey: "cold:e1:read:reactivate" });
    expect(updatesOf()).toContainEqual({ where: { id: "e1", status: "ACTIVE" }, data: { reactivatedAt: now } });
    expect(updatesOf().some((u) => "lastSignal" in u.data)).toBe(false);
  });

  it("no reactivation while a campaign follow-up is still open", async () => {
    enrollment.currentStep = 2;
    views = [view({ lastSeenAt: new Date(now.getTime() - 8 * DAY), startedAt: new Date(now.getTime() - 8 * DAY) })];
    db.messageFindMany.mockResolvedValue([{ sentAt: new Date(now.getTime() - 9 * DAY), kind: "STEP" }]);
    db.followupCount.mockResolvedValue(1);
    await evaluateEnrollmentReading("l1", now);
    expect(queueFollowup).not.toHaveBeenCalled();
    expect(updatesOf().some((u) => "reactivatedAt" in u.data)).toBe(false);
  });

  it("does not cancel the open deep-read follow-up when no prospect row can take the pricing one", async () => {
    enrollment.status = "PAUSED";
    enrollment.pausedReason = "deep_read";
    enrollment.lastSignal = "deep";
    db.followupCount.mockResolvedValue(1);
    db.prospectFindFirst.mockResolvedValue(null);
    readingOfLink.mockResolvedValue({ readingMs: 90_000, pricingMs: 45_000, tags: [] });
    await evaluateEnrollmentReading("l1", now);
    expect(db.followupUpdateMany).not.toHaveBeenCalled();
    expect(queueFollowup).not.toHaveBeenCalled();
    expect(updatesOf()[0]).toEqual({ where: { id: "e1", status: "PAUSED" }, data: { lastSignal: "pricing" } });
  });

  it("forward: the schedule is untouched, readEvaluatedAt is stamped, the same forward is not news next time", async () => {
    const forward = { createdAt: new Date(now.getTime() - 10 * MIN), toProspect: { email: "boss@acme.com" } };
    db.forwardFindMany.mockResolvedValue([forward]);
    views = [view({ lastSeenAt: new Date(now.getTime() - 20 * MIN) })];
    await evaluateEnrollmentReading("l1", now);
    expect(updatesOf().some((u) => "lastSignal" in u.data)).toBe(false);
    expect(updatesOf().at(-1)).toEqual({ where: { id: "e1" }, data: { readEvaluatedAt: now } });

    enrollment.readEvaluatedAt = now;
    db.enrollmentUpdateMany.mockClear();
    queueFollowup.mockClear();
    await evaluateEnrollmentReading("l1", new Date(now.getTime() + 20 * MIN));
    expect(updatesOf().at(-1)).toMatchObject({ data: { readEvaluatedAt: expect.any(Date) } });
  });

  it("a deep read in the same session as a new forward still pauses, alerts and queues the follow-up", async () => {
    db.forwardFindMany.mockResolvedValue([{ createdAt: new Date(now.getTime() - MIN), toProspect: { email: "boss@acme.com" } }]);
    reread();
    expect(await evaluateEnrollmentReading("l1", now)).toBe("pause_alert");
    expect(updatesOf()[0]).toEqual({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "deep_read", pausedAt: now, lastSignal: "deep" },
    });
    expect(notifySeller.mock.calls[0][0].dedupeKey).toBe("cold_call:l1:deep_read");
    expect(queueFollowup.mock.calls[0][0]).toMatchObject({ trigger: "COLD_READ" });
    expect(updatesOf().filter((u) => "readEvaluatedAt" in u.data)).toHaveLength(1);
  });

  it("an opened sequence with no step left waits out the reactivation window instead of finishing", async () => {
    enrollment.currentStep = 2;
    views = [view({ lastSeenAt: new Date(now.getTime() - 2 * DAY), startedAt: new Date(now.getTime() - 2 * DAY) })];
    db.messageFindMany.mockResolvedValue([{ sentAt: new Date(now.getTime() - 9 * DAY), kind: "STEP" }]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("wait");
    expect(releaseCampaignLink).not.toHaveBeenCalled();
  });

  it("a never-opened sequence still finishes three days after the last mail", async () => {
    enrollment.currentStep = 2;
    views = [];
    db.messageFindMany.mockResolvedValue([{ sentAt: new Date(now.getTime() - 4 * DAY), kind: "STEP" }]);
    expect(await evaluateEnrollmentReading("l1", now)).toBe("finish");
    expect(releaseCampaignLink).toHaveBeenCalledWith("l1");
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
    expect(reactivation.sql).toContain(`cp."reactivatedAt" IS NOT NULL`);
    // never opened: the end of the sequence three days after the last sent mail
    expect(reactivation.sql).toContain(`l."lastActivityAt" IS NULL`);
    expect(reactivation.sql).toContain(`MAX(m."sentAt")`);
    expect(reactivation.sql).toContain(`cp."currentStep" >= (SELECT COUNT(*)`);
    expect(reactivation.values).toEqual(
      expect.arrayContaining([new Date(now.getTime() - 5 * DAY), new Date(now.getTime() - DAY), new Date(now.getTime() - 3 * DAY), "org", 50]),
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

  it("stops at the scope's deadline", async () => {
    db.queryRaw.mockResolvedValue([{ linkId: "l1" }]);
    expect(await evaluateReadingSignals(now, { deadline: new Date(Date.now() - 1) })).toBe(0);
    expect(db.queryRaw).toHaveBeenCalledTimes(1);
    expect(db.linkFindUnique).not.toHaveBeenCalled();
  });

  it("keeps going when one enrollment throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.queryRaw.mockResolvedValueOnce([{ linkId: "l1" }, { linkId: "l2" }]).mockResolvedValueOnce([]);
    db.linkFindUnique.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(null);
    expect(await evaluateReadingSignals(now)).toBe(1);
  });
});
