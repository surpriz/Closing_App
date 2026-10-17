import { DAY_MS } from "../constants";

/** Time window of the dashboard funnel and activity feed, kept in `?p=`. */

export type PeriodKey = "7d" | "30d" | "all";

export const DEFAULT_PERIOD: PeriodKey = "30d";

/** Labels live in the "today.period" messages, keyed by period. */
export const PERIODS: Record<PeriodKey, { days: number | null }> = {
  "7d": { days: 7 },
  "30d": { days: 30 },
  all: { days: null },
};

export function parsePeriod(raw: string | string[] | undefined): PeriodKey {
  return typeof raw === "string" && Object.hasOwn(PERIODS, raw) ? (raw as PeriodKey) : DEFAULT_PERIOD;
}

/** Start of the window, or null for "all". */
export function periodStart(key: PeriodKey, now: Date): Date | null {
  const { days } = PERIODS[key];
  return days === null ? null : new Date(now.getTime() - days * DAY_MS);
}
