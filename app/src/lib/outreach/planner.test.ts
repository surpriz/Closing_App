import { describe, expect, it } from "vitest";

import { DAY_MS } from "@/lib/closing/constants";
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
  type PlannerStep,
} from "./planner";

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
    const enrollment = { status: "ACTIVE" as const, currentStep: 2, lastSentAt };
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
