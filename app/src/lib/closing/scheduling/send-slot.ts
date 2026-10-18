import { createHash } from "node:crypto";

import { getLocalParts, nextBusinessSlot, zonedTimeToUtc, type BusinessHours } from "./business-hours";

/**
 * When a follow-up lands: at the hour this prospect usually reads (or, before they ever read, the
 * hour this workspace's prospects read), inside business hours, a few minutes past the hour so it
 * does not look scheduled. Without any reading habit it is the opening hour, as before. Pure.
 */

/** Readings needed before an hour counts as a habit. */
export const MIN_PROSPECT_READINGS = 2;
export const MIN_WORKSPACE_READINGS = 10;
const MAX_JITTER_MIN = 40;
const MIN_JITTER_MIN = 4;

/** The local hour most readings started at, inside business hours. Pure. */
export function habitualHour(
  readings: { at: Date; timeZone: string }[],
  hours: BusinessHours,
  minReadings: number,
): number | null {
  const counts = new Map<number, number>();
  let inHours = 0;
  for (const { at, timeZone } of readings) {
    let hour: number;
    try {
      hour = getLocalParts(at, timeZone).hour;
    } catch {
      continue;
    }
    if (hour < hours.startHour || hour >= hours.endHour) continue;
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
    inHours++;
  }
  if (inHours < minReadings) return null;
  // Ties go to the earlier hour: a message read in the morning has the day to get an answer
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

/** A stable number of minutes past the hour for this message. Pure. */
export function jitterMinutes(seed: string) {
  const value = createHash("sha256").update(seed).digest().readUInt16BE(0);
  return MIN_JITTER_MIN + (value % (MAX_JITTER_MIN - MIN_JITTER_MIN));
}

/**
 * Like nextBusinessSlot, then moved to the habitual hour of the day it falls on (or the next
 * business day when that hour has passed). Pure.
 */
export function nextSendSlot(
  from: Date,
  timeZone: string,
  hours: BusinessHours,
  mode: "asap" | "next-morning",
  hour: number | null,
  /** Picks the minutes past the hour; without it, on the hour. */
  seed: string | null,
) {
  const base = nextBusinessSlot(from, timeZone, hours, mode);
  // Open right now and no habit: now is fine, as before
  if (hour === null && (!seed || base.getTime() === from.getTime())) return base;
  const minutes = seed ? jitterMinutes(seed) : 0;
  const target = hour ?? hours.startHour;

  const local = getLocalParts(base, timeZone);
  for (let offset = 0; offset <= 14; offset++) {
    const day = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
    const weekday = ((day.getUTCDay() + 6) % 7) + 1;
    if (!hours.days.includes(weekday)) continue;
    const slot = zonedTimeToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), target, minutes, timeZone);
    if (slot >= base) return slot;
  }
  return base;
}
