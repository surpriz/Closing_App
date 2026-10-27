import { getLocalParts } from "@/lib/closing/scheduling/business-hours";

/** A new mailbox earns its volume: sending 40 a day from day one is what gets a fresh inbox flagged. */
export const RAMP = [
  { throughDay: 7, perDay: 5 },
  { throughDay: 14, perDay: 12 },
  { throughDay: 21, perDay: 20 },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar day as the mailbox's owner lives it, e.g. "2026-10-27". Keys the daily counter. */
export function localDayKey(at: Date, timeZone: string) {
  const p = getLocalParts(at, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Local calendar days since the ramp started, the connection day being day 1. */
export function mailboxAgeDays(rampStartedAt: Date, timeZone: string, now: Date) {
  const a = getLocalParts(rampStartedAt, timeZone);
  const b = getLocalParts(now, timeZone);
  // Both days as UTC midnights: the difference is whole days whatever the DST shifts in between
  const days = (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000;
  return days + 1;
}

/** What this mailbox may send today: the ramp step, never above its own cap or the global max. */
export function dailyAllowance(
  mailbox: { rampStartedAt: Date; dailyCap: number; timezone: string },
  now: Date,
  caps: { max: number },
) {
  const age = mailboxAgeDays(mailbox.rampStartedAt, mailbox.timezone, now);
  const step = RAMP.find((s) => age <= s.throughDay)?.perDay ?? Infinity;
  return Math.max(0, Math.min(mailbox.dailyCap, caps.max, step));
}

/** What is left of today's allowance. A count from another local day does not carry over. */
export function remainingToday(
  mailbox: { rampStartedAt: Date; dailyCap: number; timezone: string; sentDay: string | null; sentCount: number },
  now: Date,
  caps: { max: number },
) {
  const allowance = dailyAllowance(mailbox, now, caps);
  const sent = mailbox.sentDay === localDayKey(now, mailbox.timezone) ? mailbox.sentCount : 0;
  return Math.max(0, allowance - sent);
}
