import type { Prisma } from "@/generated/prisma/client";

import { DAY_MS, HOUR_MS } from "./constants";
import { getLocalParts, nextBusinessSlot, zonedTimeToUtc, type BusinessHours } from "./scheduling/business-hours";

/**
 * Link expiry: after `Link.expiresAt` the viewer locks and the prospect can ask
 * for more time. Pure, shared by the viewer, the dashboard and the engine.
 */

/** Only offers carry a price worth a countdown: a deck or an audit just locks. */
export const COUNTDOWN_DOC_TYPES = ["QUOTE", "PROPOSAL"] as const;

export function showsCountdown(docType: string | null | undefined) {
  return (COUNTDOWN_DOC_TYPES as readonly string[]).includes(docType ?? "");
}

export function isLinkExpired(link: { expiresAt: Date | null }, now: Date) {
  return !!link.expiresAt && link.expiresAt.getTime() <= now.getTime();
}

/** Where-clause fragment. It holds an OR: always put it in `AND: [...]`, a spread would clobber another OR. */
export function notExpired(now: Date): Prisma.LinkWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

// ─── Countdown ────────────────────────────────────────────────────────────────

export type CountdownUnits = { d: string; h: string; min: string; s: string };

/** "3 j 4 h" from three days, "47h 12min" under three days, "12min 05s" under an hour. */
export function formatCountdown(ms: number, units: CountdownUnits) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (ms >= 72 * HOUR_MS) return `${days} ${units.d} ${hours} ${units.h}`;
  if (ms >= HOUR_MS) return `${days * 24 + hours}${units.h} ${String(minutes).padStart(2, "0")}${units.min}`;
  return `${minutes}${units.min} ${String(seconds).padStart(2, "0")}${units.s}`;
}

/** Seconds only matter in the last hour. */
export function countdownTickMs(ms: number) {
  return ms < HOUR_MS ? 1000 : 30_000;
}

// ─── Setting a date ───────────────────────────────────────────────────────────

export const EXPIRY_PRESETS = ["48h", "7d", "15d", "30d"] as const;
export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number];

export const EXTENSION_DAYS = [3, 7, 14] as const;

const MAX_EXPIRY_DAYS = 365;

/** 23:59 that day where the seller lives: "valable jusqu'au 17" includes the 17th. */
export function endOfLocalDay(isoDate: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const date = zonedTimeToUtc(Number(match[1]), Number(match[2]), Number(match[3]), 23, 59, timeZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "48h" is exact; day presets end that evening, local time. */
export function expiryFromPreset(preset: ExpiryPreset, now: Date, timeZone: string) {
  if (preset === "48h") return new Date(now.getTime() + 48 * HOUR_MS);
  const days = Number.parseInt(preset, 10);
  const local = getLocalParts(new Date(now.getTime() + days * DAY_MS), timeZone);
  return zonedTimeToUtc(local.year, local.month, local.day, 23, 59, timeZone);
}

/** +N days from the current date, or from now when it has already passed. */
export function extendExpiry(current: Date | null, now: Date, days: number) {
  const from = current && current.getTime() > now.getTime() ? current : now;
  return new Date(from.getTime() + days * DAY_MS);
}

export function expiryError(date: Date, now: Date) {
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) return "Choisissez une date à venir.";
  if (date.getTime() > now.getTime() + MAX_EXPIRY_DAYS * DAY_MS) return "Un an maximum.";
  return null;
}

/** The link was locked and the new date opens it again: whoever asked should hear about it. */
export function reactivates(previous: Date | null, next: Date | null, now: Date) {
  return isLinkExpired({ expiresAt: previous }, now) && !isLinkExpired({ expiresAt: next }, now);
}

// ─── Dedupe keys (the date is in the key: a new date re-arms everything) ─────

export function extensionRequestKey(linkId: string, expiresAt: Date, who: string) {
  return `extension_request:${linkId}:${expiresAt.getTime()}:${who}`;
}

export function expiryReminderKey(linkId: string, expiresAt: Date, prospectId: string) {
  return `expiry_reminder:${linkId}:${expiresAt.getTime()}:${prospectId}`;
}

export function linkExpiringKey(linkId: string, expiresAt: Date) {
  return `link_expiring:${linkId}:${expiresAt.getTime()}`;
}

// ─── Engine timing ────────────────────────────────────────────────────────────

/** Aim: two days before. */
export const REMINDER_IDEAL_LEAD_MS = 48 * HOUR_MS;
/** Drafted a day earlier, so a copilot seller has time to approve it. */
export const REMINDER_DRAFT_LEAD_MS = 72 * HOUR_MS;
/** Closer than this, a reminder reads as pressure and comes too late to act on. */
export const REMINDER_MIN_LEAD_MS = 12 * HOUR_MS;
/** Not right after the proposal itself was sent. */
export const REMINDER_MIN_AFTER_SEND_MS = 12 * HOUR_MS;
/** An unapproved reminder still waiting this close to the deadline is dropped. */
export const REMINDER_MIN_SEND_LEAD_MS = HOUR_MS;
export const SELLER_ALERT_LEAD_MS = 24 * HOUR_MS;

export type ReminderPlan =
  | { kind: "wait" }
  | { kind: "skip"; reason: "expired" | "not_sent" | "too_close" }
  | { kind: "queue"; scheduledFor: Date };

/** When to remind the prospect of the deadline: two days before in business hours, or as soon as still useful. */
export function expiryReminderPlan(input: {
  now: Date;
  expiresAt: Date;
  sentAt: Date | null;
  timezone: string;
  hours: BusinessHours;
}): ReminderPlan {
  const { now, expiresAt, sentAt, timezone, hours } = input;
  const deadline = expiresAt.getTime();
  if (deadline <= now.getTime()) return { kind: "skip", reason: "expired" };
  if (!sentAt) return { kind: "skip", reason: "not_sent" };
  if (now.getTime() < deadline - REMINDER_DRAFT_LEAD_MS) return { kind: "wait" };

  const floor = Math.max(now.getTime(), sentAt.getTime() + REMINDER_MIN_AFTER_SEND_MS);
  const latest = deadline - REMINDER_MIN_LEAD_MS;

  const ideal = nextBusinessSlot(new Date(Math.max(floor, deadline - REMINDER_IDEAL_LEAD_MS)), timezone, hours, "asap");
  if (ideal.getTime() <= latest) return { kind: "queue", scheduledFor: ideal };

  // Two days before fell on a weekend or night, or the date was set close: earliest useful slot
  const fallback = nextBusinessSlot(new Date(floor), timezone, hours, "asap");
  if (fallback.getTime() <= latest) return { kind: "queue", scheduledFor: fallback };
  return { kind: "skip", reason: "too_close" };
}

// ─── Wording ──────────────────────────────────────────────────────────────────

/** "jeudi 15 octobre à 18:00" / "Thursday, October 15 at 6:00 PM", in the reader's time zone. */
export function formatDeadline(expiresAt: Date, locale: string, timeZone: string, options: { showZone?: boolean } = {}) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.showZone ? { timeZoneName: "short" } : {}),
  }).format(expiresAt);
}

/**
 * The deadline in the words the date guard looks for ("15 octobre", "15 october"),
 * so a writer quoting the real date is not flagged as inventing one.
 */
export function deadlineSourceText(expiresAt: Date, timeZone: string) {
  const dayMonth = (locale: string) =>
    new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "long" }).format(expiresAt);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(expiresAt);
  return `Le lien de la proposition expire le ${dayMonth("fr-FR")} à ${time} (${dayMonth("en-GB")}).`;
}
