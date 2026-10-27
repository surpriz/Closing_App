import { getLocalParts, zonedTimeToUtc, type BusinessHours } from "@/lib/closing/scheduling/business-hours";
import { jitterMinutes } from "@/lib/closing/scheduling/send-slot";

// jitterMinutes returns 4..39: shifting by 22 centres it, so a slot moves by -18..+17 minutes
const JITTER_CENTER_MIN = 22;
const MAX_LOOKAHEAD_DAYS = 14;

type LocalDay = { year: number; month: number; day: number };

/** The local day `offset` days after `from`'s, with its ISO weekday. Calendar arithmetic, immune to DST. */
function localDayAfter(from: LocalDay, offset: number) {
  const date = new Date(Date.UTC(from.year, from.month - 1, from.day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: ((date.getUTCDay() + 6) % 7) + 1,
  };
}

/** Slots of one given business day, spread evenly over the opening hours, each nudged so they do not look scheduled. */
function slotsOfDay(d: LocalDay, timeZone: string, hours: BusinessHours, count: number, seed: string) {
  const open = hours.startHour * 60;
  const close = hours.endHour * 60;
  const step = (close - open) / count;
  const slots: Date[] = [];
  for (let i = 0; i < count; i++) {
    const nominal = open + (i + 0.5) * step;
    const minute = Math.round(nominal + jitterMinutes(`${seed}:${i}`) - JITTER_CENTER_MIN);
    // The window is [start, end): the last allowed minute is one before closing
    const bounded = Math.min(Math.max(minute, open), close - 1);
    slots.push(zonedTimeToUtc(d.year, d.month, d.day, Math.floor(bounded / 60), bounded % 60, timeZone));
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * `count` send times over the opening hours of the local day of `day` (the next business day when that one is
 * closed). Same seed, same times: a retry of the planner does not move already planned messages. Pure.
 */
export function sendWindow(input: { day: Date; timeZone: string; hours: BusinessHours; count: number; seed: string }) {
  const { day, timeZone, hours, count, seed } = input;
  if (count <= 0) return [];
  const local = getLocalParts(day, timeZone);
  for (let offset = 0; offset <= MAX_LOOKAHEAD_DAYS; offset++) {
    const d = localDayAfter(local, offset);
    if (hours.days.includes(d.weekday)) return slotsOfDay(d, timeZone, hours, count, seed);
  }
  return [];
}

/**
 * The `count` next send times strictly after `from`: what is left of today's window, then the next business
 * day(s) for the rest. Pure.
 */
export function nextWindowSlots(from: Date, timeZone: string, hours: BusinessHours, count: number, seed: string) {
  const result: Date[] = [];
  if (count <= 0) return result;
  const local = getLocalParts(from, timeZone);
  for (let offset = 0; offset <= MAX_LOOKAHEAD_DAYS && result.length < count; offset++) {
    const d = localDayAfter(local, offset);
    if (!hours.days.includes(d.weekday)) continue;
    // Days get their own seed, otherwise every day would have the very same jitter
    const daySeed = `${seed}:${d.year}-${d.month}-${d.day}`;
    const wanted = count - result.length;
    // Today: the full window, minus what is already past. Later days: only what is still missing
    const slots = slotsOfDay(d, timeZone, hours, offset === 0 ? count : wanted, daySeed);
    result.push(...slots.filter((slot) => slot > from).slice(0, wanted));
  }
  return result;
}
