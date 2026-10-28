import type { EnrollmentStatus } from "@/generated/prisma/enums";
import { DAY_MS, HOUR_MS, WARM_READ_MIN_MS } from "@/lib/closing/constants";
import { getLocalParts, zonedTimeToUtc, type BusinessHours } from "@/lib/closing/scheduling/business-hours";
import { nextSendSlot } from "@/lib/closing/scheduling/send-slot";
import { localDayKey } from "@/lib/mailboxes/caps/allowance";
import { nextWindowSlots } from "@/lib/mailboxes/caps/window";

import type { EnrollmentSignals } from "./signals";

export const MAX_SENDS_PER_TICK_PER_MAILBOX = 10;
export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 30 * 60 * 1000;
export const STALE_LEASE_MS = 5 * 60 * 1000;
/** After the last step went out, the enrollment gets this long to answer before it is finished. */
export const FINISH_AFTER_LAST_STEP_MS = 3 * DAY_MS;

export type PlannerStep = { id: string; order: number; delayDays: number };
export type PlannerEnrollment = { status: EnrollmentStatus; currentStep: number; lastSentAt: Date | null };
export type ReadingSettings = {
  minDelayAfterReadingHours: number;
  maxFollowupsPer30Days: number;
  minDaysBetweenFollowups: number;
  hotPricingThresholdSec: number;
};
export const REACTIVATE_AFTER_DAYS = 5;

export type NextAction =
  | { kind: "send_step"; step: PlannerStep; earliest: Date }
  | { kind: "wait"; until: Date | null }
  | { kind: "finish" }
  // followup is null once the 30-day cap is reached: the enrollment still pauses and the seller is still alerted.
  | { kind: "pause_alert"; reason: "call_moment" | "deep_read"; followup: "COLD_READ_PRICING" | "COLD_READ" | null }
  | { kind: "ai_followup"; trigger: "COLD_REACTIVATE" }
  | { kind: "note_forward" };

/**
 * Fixed steps plus, when `signals` and `settings` are given, the reading-driven table (first matching row wins).
 * Without signals the lot 2 table applies unchanged. Pure.
 */
export function nextStepFor(input: {
  enrollment: PlannerEnrollment;
  steps: PlannerStep[];
  signals?: EnrollmentSignals;
  settings?: ReadingSettings;
  now: Date;
}): NextAction {
  const { enrollment, steps, signals, settings, now } = input;
  if (enrollment.status !== "QUEUED" && enrollment.status !== "ACTIVE") return { kind: "wait", until: null };

  const next = steps.find((step) => step.order === enrollment.currentStep + 1);
  const read = signals && settings ? { signals, settings } : null;

  // Never right after a read, never too soon after the last mail (steps or follow-ups).
  let earliest = now;
  if (read) {
    const { lastReadAt, lastSentAt } = read.signals;
    const afterRead = lastReadAt ? lastReadAt.getTime() + read.settings.minDelayAfterReadingHours * HOUR_MS : 0;
    const afterSent = lastSentAt ? lastSentAt.getTime() + read.settings.minDaysBetweenFollowups * DAY_MS : 0;
    earliest = new Date(Math.max(now.getTime(), afterRead, afterSent));
  }

  if (read) {
    const { signals: sig, settings: cfg } = read;
    const capped = sig.sentLast30 >= cfg.maxFollowupsPer30Days;

    if (sig.replied) return { kind: "finish" };
    if (sig.forwardedTo.length > 0) return { kind: "note_forward" };
    if (
      sig.opened &&
      sig.pricingMs > 0 &&
      sig.pricingMs >= cfg.hotPricingThresholdSec * 1000 &&
      sig.lastSignal !== "pricing"
    ) {
      return { kind: "pause_alert", reason: "call_moment", followup: capped ? null : "COLD_READ_PRICING" };
    }
    if ((sig.deepRead || sig.sessions >= 2) && sig.lastSignal !== "deep" && sig.lastSignal !== "pricing") {
      return { kind: "pause_alert", reason: "deep_read", followup: capped ? null : "COLD_READ" };
    }
    // A skim does not move the sequence forward faster; the next step only waits out the reading delay.
    // With no step left the later rows apply.
    if (sig.opened && sig.readingMs < WARM_READ_MIN_MS && next) return sendStep(enrollment, next, earliest, now);
    if (
      sig.opened &&
      sig.lastReadAt &&
      sig.lastReadAt.getTime() < now.getTime() - REACTIVATE_AFTER_DAYS * DAY_MS &&
      !next &&
      !sig.reactivatedAt
    ) {
      // At the cap the reactivation is not generated, it just waits.
      return capped ? { kind: "wait", until: earliest } : { kind: "ai_followup", trigger: "COLD_REACTIVATE" };
    }
  }

  if (next) return sendStep(enrollment, next, earliest, now);

  // A reader who opened it gets the reactivation window before the sequence ends
  if (signals && signals.opened && signals.lastReadAt && !signals.reactivatedAt) {
    const until = new Date(signals.lastReadAt.getTime() + REACTIVATE_AFTER_DAYS * DAY_MS);
    if (until.getTime() > now.getTime()) return { kind: "wait", until };
  }

  if (!enrollment.lastSentAt) return finishOrWait(signals);
  const until = new Date(enrollment.lastSentAt.getTime() + FINISH_AFTER_LAST_STEP_MS);
  return until.getTime() <= now.getTime() ? finishOrWait(signals) : { kind: "wait", until };
}

function sendStep(enrollment: PlannerEnrollment, step: PlannerStep, earliest: Date, now: Date): NextAction {
  if (enrollment.currentStep === 0 || !enrollment.lastSentAt) return { kind: "send_step", step, earliest };
  const due = enrollment.lastSentAt.getTime() + step.delayDays * DAY_MS;
  return { kind: "send_step", step, earliest: new Date(Math.max(now.getTime(), earliest.getTime(), due)) };
}

/** A sequence is not over while a campaign follow-up is still open (draft, scheduled). */
function finishOrWait(signals: EnrollmentSignals | undefined): NextAction {
  return signals?.openFollowup ? { kind: "wait", until: null } : { kind: "finish" };
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
