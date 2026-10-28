import { describe, expect, it } from "vitest";

import type { EnrollmentStatus } from "@/generated/prisma/enums";
import { DAY_MS, HOUR_MS, WARM_READ_MIN_MS } from "@/lib/closing/constants";
import { getLocalParts } from "@/lib/closing/scheduling/business-hours";

import {
  FINISH_AFTER_LAST_STEP_MS,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  businessHoursOf,
  firstSendSlots,
  inBusinessHours,
  localDayBounds,
  nextStepFor,
  retryAt,
  stepSendAt,
  templateVarsOf,
  type PlannerEnrollment,
  type PlannerStep,
  type ReadingSettings,
} from "./planner";
import type { EnrollmentSignals } from "./signals";

const hours = { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] };
const steps: PlannerStep[] = [
  { id: "s1", order: 1, delayDays: 0 },
  { id: "s2", order: 2, delayDays: 3 },
];
const now = new Date("2026-10-28T10:00:00Z");

describe("nextStepFor", () => {
  it("sends step 1 right away for a QUEUED enrollment", () => {
    const action = nextStepFor({ enrollment: { status: "QUEUED", currentStep: 0, lastSentAt: null }, steps, now });
    expect(action).toEqual({ kind: "send_step", step: steps[0], earliest: now });
  });

  it("waits for the step delay after the last send", () => {
    const lastSentAt = new Date(now.getTime() - DAY_MS);
    const action = nextStepFor({ enrollment: { status: "ACTIVE", currentStep: 1, lastSentAt }, steps, now });
    expect(action).toEqual({ kind: "send_step", step: steps[1], earliest: new Date(lastSentAt.getTime() + 3 * DAY_MS) });
  });

  it("does not go back in time when the delay is already over", () => {
    const lastSentAt = new Date(now.getTime() - 10 * DAY_MS);
    const action = nextStepFor({ enrollment: { status: "ACTIVE", currentStep: 1, lastSentAt }, steps, now });
    expect(action).toEqual({ kind: "send_step", step: steps[1], earliest: now });
  });

  it("waits 3 days after the last step, then finishes", () => {
    const lastSentAt = new Date(now.getTime() - DAY_MS);
    const enrollment = { status: "ACTIVE" as EnrollmentStatus, currentStep: 2, lastSentAt };
    expect(nextStepFor({ enrollment, steps, now })).toEqual({
      kind: "wait",
      until: new Date(lastSentAt.getTime() + FINISH_AFTER_LAST_STEP_MS),
    });
    const later = new Date(lastSentAt.getTime() + FINISH_AFTER_LAST_STEP_MS);
    expect(nextStepFor({ enrollment, steps, now: later })).toEqual({ kind: "finish" });
  });

  it("finishes when there is nothing left and nothing was ever sent", () => {
    const action = nextStepFor({ enrollment: { status: "QUEUED", currentStep: 0, lastSentAt: null }, steps: [], now });
    expect(action).toEqual({ kind: "finish" });
  });

  it.each(["PAUSED", "REPLIED", "BOUNCED", "UNSUBSCRIBED", "SUPPRESSED", "FINISHED", "STOPPED"] as const)(
    "does nothing for %s",
    (status) => {
      const action = nextStepFor({ enrollment: { status, currentStep: 0, lastSentAt: null }, steps, now });
      expect(action).toEqual({ kind: "wait", until: null });
    },
  );
});

describe("businessHoursOf", () => {
  it("maps the workspace settings", () => {
    expect(businessHoursOf({ businessHourStart: 8, businessHourEnd: 17, businessDays: [1, 2] })).toEqual({
      startHour: 8,
      endHour: 17,
      days: [1, 2],
    });
  });
});

describe("stepSendAt", () => {
  it("pushes a Saturday to Monday morning, a few minutes past the opening hour", () => {
    const saturday = new Date("2026-10-31T10:00:00Z");
    const at = stepSendAt(saturday, "Europe/Paris", hours, "enr:2");
    const local = getLocalParts(at, "Europe/Paris");
    expect(local).toMatchObject({ month: 11, day: 2, weekday: 1, hour: 9 });
    expect(local.minute).toBeGreaterThanOrEqual(4);
  });

  it("is stable for the same seed", () => {
    const saturday = new Date("2026-10-31T10:00:00Z");
    expect(stepSendAt(saturday, "Europe/Paris", hours, "x")).toEqual(stepSendAt(saturday, "Europe/Paris", hours, "x"));
  });
});

describe("firstSendSlots", () => {
  const input = { count: 4, from: new Date("2026-10-28T06:00:00Z"), mailboxTimeZone: "Europe/Paris", hours, mailboxId: "mb1" };

  it("is deterministic for a given local day and inside business hours", () => {
    const a = firstSendSlots(input);
    expect(a).toHaveLength(4);
    expect(firstSendSlots(input)).toEqual(a);
    for (const slot of a) expect(inBusinessHours(slot, "Europe/Paris", hours)).toBe(true);
  });

  it("rolls over to tomorrow when today is almost over", () => {
    const slots = firstSendSlots({ ...input, from: new Date("2026-10-28T16:00:00Z"), count: 5 });
    expect(slots).toHaveLength(5);
    expect(getLocalParts(slots[4], "Europe/Paris").day).toBe(29);
  });
});

describe("inBusinessHours", () => {
  it("includes the opening minute and excludes 18:00", () => {
    // 2026-10-28 is a Wednesday, Paris is UTC+1 after the 25th
    expect(inBusinessHours(new Date("2026-10-28T08:00:00Z"), "Europe/Paris", hours)).toBe(true);
    expect(inBusinessHours(new Date("2026-10-28T07:59:00Z"), "Europe/Paris", hours)).toBe(false);
    expect(inBusinessHours(new Date("2026-10-28T16:59:00Z"), "Europe/Paris", hours)).toBe(true);
    expect(inBusinessHours(new Date("2026-10-28T17:00:00Z"), "Europe/Paris", hours)).toBe(false);
  });

  it("is closed on a weekend", () => {
    expect(inBusinessHours(new Date("2026-10-31T10:00:00Z"), "Europe/Paris", hours)).toBe(false);
  });
});

describe("localDayBounds", () => {
  it("covers 25 hours on the day clocks go back (Europe/Paris, 25 Oct 2026)", () => {
    const { start, end } = localDayBounds(new Date("2026-10-25T12:00:00Z"), "Europe/Paris");
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("covers 24 hours on a normal day", () => {
    const { start, end } = localDayBounds(new Date("2026-10-28T12:00:00Z"), "Europe/Paris");
    expect(end.getTime() - start.getTime()).toBe(DAY_MS);
  });
});

describe("retryAt", () => {
  it("retries 30 minutes later until the attempts are used up", () => {
    expect(retryAt(now, 1)).toEqual(new Date(now.getTime() + RETRY_DELAY_MS));
    expect(retryAt(now, MAX_ATTEMPTS - 1)).not.toBeNull();
    expect(retryAt(now, MAX_ATTEMPTS)).toBeNull();
  });
});

describe("templateVarsOf", () => {
  const enrollment = {
    email: "a@acme.com",
    firstName: "Ana",
    lastName: null,
    company: "Acme",
    title: null,
    vars: { city: "Lyon", company: "From CSV", count: 3, nested: { a: 1 } },
  };

  it("lets the fixed columns win over a CSV column of the same name", () => {
    const vars = templateVarsOf(enrollment, "https://x.test/v/1");
    expect(vars).toEqual({
      city: "Lyon",
      email: "a@acme.com",
      firstName: "Ana",
      lastName: null,
      company: "Acme",
      title: null,
      link: "https://x.test/v/1",
    });
  });

  it("copes with missing or malformed custom vars", () => {
    expect(templateVarsOf({ ...enrollment, vars: null }, null).link).toBeNull();
    expect(templateVarsOf({ ...enrollment, vars: ["x"] }, null)).not.toHaveProperty("0");
  });
});

describe("nextStepFor with reading signals", () => {
  const settings: ReadingSettings = {
    minDelayAfterReadingHours: 4,
    maxFollowupsPer30Days: 3,
    minDaysBetweenFollowups: 2,
    hotPricingThresholdSec: 20,
  };
  const quiet: EnrollmentSignals = {
    opened: false,
    readingMs: 0,
    pricingMs: 0,
    sessions: 0,
    deepRead: false,
    lastReadAt: null,
    readTags: [],
    forwardedTo: [],
    replied: false,
    lastSentAt: null,
    sentLast30: 0,
    lastSignal: null,
    reactivatedAt: null,
    openFollowup: false,
  };
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const sent1 = { status: "ACTIVE" as EnrollmentStatus, currentStep: 1, lastSentAt: ago(10 * DAY_MS) };
  const lastStepDone = { status: "ACTIVE" as EnrollmentStatus, currentStep: 2, lastSentAt: ago(10 * DAY_MS) };
  const plan = (signals: Partial<EnrollmentSignals>, enrollment: PlannerEnrollment = sent1) =>
    nextStepFor({ enrollment, steps, signals: { ...quiet, ...signals }, settings, now });

  it("keeps the lot 2 table when signals are absent", () => {
    expect(nextStepFor({ enrollment: sent1, steps, now })).toEqual({
      kind: "send_step",
      step: steps[1],
      earliest: now,
    });
    expect(nextStepFor({ enrollment: sent1, steps, settings, now })).toEqual(nextStepFor({ enrollment: sent1, steps, now }));
  });

  it("matches the lot 2 table for a quiet enrollment", () => {
    expect(plan({})).toEqual(nextStepFor({ enrollment: sent1, steps, now }));
    expect(plan({}, lastStepDone)).toEqual({ kind: "finish" });
  });

  it("finishes when the prospect replied, over everything else", () => {
    const loud = { replied: true, forwardedTo: ["a@b.co"], pricingMs: 99_000, deepRead: true, opened: true };
    expect(plan(loud)).toEqual({ kind: "finish" });
  });

  it("notes a forward once", () => {
    expect(plan({ forwardedTo: ["a@b.co"] })).toEqual({ kind: "note_forward" });
    expect(plan({ forwardedTo: ["a@b.co"], lastSignal: "forward" })).not.toEqual({ kind: "note_forward" });
  });

  it("pauses on a pricing read (call moment), once", () => {
    expect(plan({ pricingMs: 20_000, opened: true })).toEqual({
      kind: "pause_alert",
      reason: "call_moment",
      followup: "COLD_READ_PRICING",
    });
    expect(plan({ pricingMs: 19_999, opened: true, readingMs: 60_000 })).toMatchObject({ kind: "send_step" });
    expect(plan({ pricingMs: 50_000, opened: true, lastSignal: "pricing" })).not.toMatchObject({ kind: "pause_alert" });
  });

  it("pauses on a deep read or a second session, unless already signalled", () => {
    const deep = { kind: "pause_alert", reason: "deep_read", followup: "COLD_READ" };
    expect(plan({ deepRead: true, opened: true })).toEqual(deep);
    expect(plan({ sessions: 2, opened: true })).toEqual(deep);
    expect(plan({ sessions: 1, opened: true, readingMs: 60_000 })).toMatchObject({ kind: "send_step" });
    expect(plan({ deepRead: true, opened: true, lastSignal: "deep" })).not.toMatchObject({ kind: "pause_alert" });
    expect(plan({ deepRead: true, opened: true, lastSignal: "pricing" })).not.toMatchObject({ kind: "pause_alert" });
  });

  it("lets a forward signal still allow a deep read alert", () => {
    expect(plan({ deepRead: true, opened: true, lastSignal: "forward" })).toMatchObject({ reason: "deep_read" });
  });

  it("ranks forward over pricing, pricing over deep read", () => {
    const both = { pricingMs: 30_000, deepRead: true, opened: true };
    expect(plan(both)).toMatchObject({ reason: "call_moment" });
    expect(plan({ ...both, forwardedTo: ["a@b.co"] })).toEqual({ kind: "note_forward" });
  });

  it("does not fall back to a deep read once pricing was signalled", () => {
    expect(plan({ pricingMs: 30_000, deepRead: true, opened: true, lastSignal: "pricing" })).toMatchObject({
      kind: "send_step",
    });
  });

  it("pushes the next step past the reading delay after a skim", () => {
    const lastReadAt = ago(HOUR_MS);
    const action = plan({ opened: true, readingMs: WARM_READ_MIN_MS - 1, lastReadAt });
    expect(action).toEqual({ kind: "send_step", step: steps[1], earliest: new Date(lastReadAt.getTime() + 4 * HOUR_MS) });
  });

  it("does not move a skim's step when the reading delay has passed", () => {
    const action = plan({ opened: true, readingMs: 1_000, lastReadAt: ago(5 * HOUR_MS) });
    expect(action).toEqual({ kind: "send_step", step: steps[1], earliest: now });
  });

  it("also holds the next step back after a warm read", () => {
    const lastReadAt = ago(HOUR_MS);
    const action = plan({ opened: true, readingMs: 60_000, lastReadAt });
    expect(action).toMatchObject({ kind: "send_step", earliest: new Date(lastReadAt.getTime() + 4 * HOUR_MS) });
  });

  it("computes earliest as the max of now, read delay and the gap since the last mail", () => {
    const enrollment = { status: "ACTIVE" as EnrollmentStatus, currentStep: 1, lastSentAt: ago(DAY_MS) };
    // due by delayDays: lastSent + 3d; the gap rule (lastSent + 2d) is earlier, the fixed delay wins
    const byDelay = plan({ lastSentAt: ago(DAY_MS) }, enrollment);
    expect(byDelay).toMatchObject({ earliest: new Date(enrollment.lastSentAt.getTime() + 3 * DAY_MS) });
    const stepsFast: PlannerStep[] = [steps[0], { id: "s2", order: 2, delayDays: 0 }];
    const byGap = nextStepFor({ enrollment, steps: stepsFast, signals: { ...quiet, lastSentAt: ago(DAY_MS) }, settings, now });
    expect(byGap).toMatchObject({ earliest: new Date(ago(DAY_MS).getTime() + 2 * DAY_MS) });
    const byRead = nextStepFor({
      enrollment,
      steps: stepsFast,
      signals: { ...quiet, lastSentAt: ago(DAY_MS), opened: true, readingMs: 60_000, lastReadAt: ago(0) },
      settings: { ...settings, minDaysBetweenFollowups: 0 },
      now,
    });
    expect(byRead).toMatchObject({ earliest: new Date(now.getTime() + 4 * HOUR_MS) });
  });

  it("reactivates a cold read once, when nothing is left to send", () => {
    const cold = { opened: true, readingMs: 60_000, lastReadAt: ago(6 * DAY_MS) };
    expect(plan(cold, lastStepDone)).toEqual({ kind: "ai_followup", trigger: "COLD_REACTIVATE" });
    expect(plan({ ...cold, reactivatedAt: ago(DAY_MS) }, lastStepDone)).toEqual({ kind: "finish" });
    expect(plan({ ...cold, lastReadAt: ago(4 * DAY_MS) }, lastStepDone)).toEqual({ kind: "finish" });
    expect(plan(cold, sent1)).toMatchObject({ kind: "send_step" });
  });

  it("at the 30-day cap, pause_alert drops its follow-up but still pauses", () => {
    expect(plan({ pricingMs: 30_000, opened: true, sentLast30: 3 })).toEqual({
      kind: "pause_alert",
      reason: "call_moment",
      followup: null,
    });
    expect(plan({ deepRead: true, opened: true, sentLast30: 3 })).toEqual({
      kind: "pause_alert",
      reason: "deep_read",
      followup: null,
    });
    expect(plan({ deepRead: true, opened: true, sentLast30: 2 })).toMatchObject({ followup: "COLD_READ" });
  });

  it("at the 30-day cap, ai_followup becomes a wait until earliest", () => {
    const lastSentAt = ago(HOUR_MS);
    const cold = { opened: true, readingMs: 60_000, lastReadAt: ago(6 * DAY_MS), sentLast30: 3, lastSentAt };
    expect(plan(cold, lastStepDone)).toEqual({ kind: "wait", until: new Date(lastSentAt.getTime() + 2 * DAY_MS) });
  });

  it("does not finish while a campaign follow-up is open", () => {
    expect(plan({ openFollowup: true }, lastStepDone)).toEqual({ kind: "wait", until: null });
    const justSent = { ...lastStepDone, lastSentAt: ago(4 * DAY_MS) };
    expect(plan({ openFollowup: true }, justSent)).toEqual({ kind: "wait", until: null });
    expect(plan({ openFollowup: false }, justSent)).toEqual({ kind: "finish" });
  });

  it("still waits out the finish delay after the last step", () => {
    const fresh = { ...lastStepDone, lastSentAt: ago(DAY_MS) };
    expect(plan({}, fresh)).toEqual({ kind: "wait", until: new Date(fresh.lastSentAt.getTime() + FINISH_AFTER_LAST_STEP_MS) });
  });

  it("never pauses an unopened enrollment, even with a pricing threshold of 0", () => {
    const zero = { ...settings, hotPricingThresholdSec: 0 };
    expect(nextStepFor({ enrollment: sent1, steps, signals: quiet, settings: zero, now })).toMatchObject({
      kind: "send_step",
    });
    expect(nextStepFor({ enrollment: sent1, steps, signals: { ...quiet, opened: true }, settings: zero, now })).toMatchObject({
      kind: "send_step",
    });
  });

  it("sends the step right away with signals when no mail went out yet", () => {
    const fresh = { status: "QUEUED" as EnrollmentStatus, currentStep: 0, lastSentAt: null };
    expect(plan({}, fresh)).toEqual({ kind: "send_step", step: steps[0], earliest: now });
    const stranded = { status: "ACTIVE" as EnrollmentStatus, currentStep: 1, lastSentAt: null };
    expect(plan({}, stranded)).toEqual({ kind: "send_step", step: steps[1], earliest: now });
  });

  it("with a cap of 0, pauses without a follow-up and reactivation waits", () => {
    const zero = { ...settings, maxFollowupsPer30Days: 0 };
    const run = (signals: Partial<EnrollmentSignals>, enrollment: PlannerEnrollment = sent1) =>
      nextStepFor({ enrollment, steps, signals: { ...quiet, ...signals }, settings: zero, now });
    expect(run({ deepRead: true, opened: true })).toEqual({ kind: "pause_alert", reason: "deep_read", followup: null });
    const lastSentAt = lastStepDone.lastSentAt;
    const cold = { opened: true, readingMs: 60_000, lastReadAt: ago(6 * DAY_MS), lastSentAt };
    expect(run(cold, lastStepDone)).toEqual({ kind: "wait", until: new Date(now.getTime()) });
  });

  it("does nothing for a paused enrollment, whatever the signals", () => {
    const paused = { ...sent1, status: "PAUSED" as EnrollmentStatus };
    expect(plan({ pricingMs: 99_000, opened: true }, paused)).toEqual({ kind: "wait", until: null });
  });
});
