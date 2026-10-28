import type { EnrollmentStatus } from "@/generated/prisma/enums";
import { DAY_MS } from "@/lib/closing/constants";
import { getLocalParts, zonedTimeToUtc, type BusinessHours } from "@/lib/closing/scheduling/business-hours";
import { nextSendSlot } from "@/lib/closing/scheduling/send-slot";
import { localDayKey } from "@/lib/mailboxes/caps/allowance";
import { nextWindowSlots } from "@/lib/mailboxes/caps/window";

export const MAX_SENDS_PER_TICK_PER_MAILBOX = 10;
export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 30 * 60 * 1000;
export const STALE_LEASE_MS = 5 * 60 * 1000;
/** After the last step went out, the enrollment gets this long to answer before it is finished. */
export const FINISH_AFTER_LAST_STEP_MS = 3 * DAY_MS;

export type PlannerStep = { id: string; order: number; delayDays: number };
export type PlannerEnrollment = { status: EnrollmentStatus; currentStep: number; lastSentAt: Date | null };
export type NextAction =
  | { kind: "send_step"; step: PlannerStep; earliest: Date }
  | { kind: "wait"; until: Date | null }
  | { kind: "finish" };

/** Fixed-step table only (reading signals arrive with lot 3). Pure. */
export function nextStepFor(input: { enrollment: PlannerEnrollment; steps: PlannerStep[]; now: Date }): NextAction {
  const { enrollment, steps, now } = input;
  if (enrollment.status !== "QUEUED" && enrollment.status !== "ACTIVE") return { kind: "wait", until: null };

  const next = steps.find((step) => step.order === enrollment.currentStep + 1);
  if (next) {
    if (enrollment.currentStep === 0 || !enrollment.lastSentAt) return { kind: "send_step", step: next, earliest: now };
    const due = enrollment.lastSentAt.getTime() + next.delayDays * DAY_MS;
    return { kind: "send_step", step: next, earliest: new Date(Math.max(now.getTime(), due)) };
  }

  if (!enrollment.lastSentAt) return { kind: "finish" };
  const until = new Date(enrollment.lastSentAt.getTime() + FINISH_AFTER_LAST_STEP_MS);
  return until.getTime() <= now.getTime() ? { kind: "finish" } : { kind: "wait", until };
}

export function businessHoursOf(settings: {
  businessHourStart: number;
  businessHourEnd: number;
  businessDays: number[];
}): BusinessHours {
  return { startHour: settings.businessHourStart, endHour: settings.businessHourEnd, days: settings.businessDays };
}

/** When a step goes out: inside the prospect's business hours, a few minutes past the hour. Pure. */
export function stepSendAt(earliest: Date, timeZone: string, hours: BusinessHours, seed: string): Date {
  return nextSendSlot(earliest, timeZone, hours, "asap", null, seed);
}

/** The slots the first mails of a mailbox get today (and tomorrow if today is full). Pure. */
export function firstSendSlots(input: {
  count: number;
  from: Date;
  mailboxTimeZone: string;
  hours: BusinessHours;
  mailboxId: string;
}): Date[] {
  const { count, from, mailboxTimeZone, hours, mailboxId } = input;
  const seed = `${mailboxId}:${localDayKey(from, mailboxTimeZone)}`;
  return nextWindowSlots(from, mailboxTimeZone, hours, count, seed);
}

export function inBusinessHours(at: Date, timeZone: string, hours: BusinessHours): boolean {
  const local = getLocalParts(at, timeZone);
  return hours.days.includes(local.weekday) && local.hour >= hours.startHour && local.hour < hours.endHour;
}

/** UTC instants of the local midnight starting the day of `at` and of the next one (a DST day is not 24h long). */
export function localDayBounds(at: Date, timeZone: string): { start: Date; end: Date } {
  const local = getLocalParts(at, timeZone);
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return {
    start: zonedTimeToUtc(local.year, local.month, local.day, 0, 0, timeZone),
    end: zonedTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, timeZone),
  };
}

/** Null once the attempts are used up: the message is FAILED instead of being tried again. */
export function retryAt(now: Date, attempts: number): Date | null {
  return attempts < MAX_ATTEMPTS ? new Date(now.getTime() + RETRY_DELAY_MS) : null;
}

/** Imported columns first, then the fixed ones on top: a CSV column named like a fixed one never wins. */
export function templateVarsOf(
  enrollment: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    title: string | null;
    vars: unknown;
  },
  link: string | null,
): Record<string, string | null> {
  const custom: Record<string, string | null> = {};
  if (enrollment.vars && typeof enrollment.vars === "object" && !Array.isArray(enrollment.vars)) {
    for (const [key, value] of Object.entries(enrollment.vars)) {
      if (typeof value === "string") custom[key] = value;
    }
  }
  return {
    ...custom,
    email: enrollment.email,
    firstName: enrollment.firstName,
    lastName: enrollment.lastName,
    company: enrollment.company,
    title: enrollment.title,
    link,
  };
}
