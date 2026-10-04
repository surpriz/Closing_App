import { DAY_MS } from "../constants";

/** Time window of the dashboard funnel and activity feed, kept in `?p=`. */

export type PeriodKey = "7d" | "30d" | "all";

export const DEFAULT_PERIOD: PeriodKey = "30d";

export const PERIODS: Record<PeriodKey, { label: string; hint: string; days: number | null }> = {
  "7d": { label: "7 jours", hint: "sur 7 jours", days: 7 },
  "30d": { label: "30 jours", hint: "sur 30 jours", days: 30 },
  all: { label: "Tout", hint: "depuis le début", days: null },
};

export function parsePeriod(raw: string | string[] | undefined): PeriodKey {
  return typeof raw === "string" && Object.hasOwn(PERIODS, raw) ? (raw as PeriodKey) : DEFAULT_PERIOD;
}

/** Start of the window, or null for "all". */
export function periodStart(key: PeriodKey, now: Date): Date | null {
  const { days } = PERIODS[key];
  return days === null ? null : new Date(now.getTime() - days * DAY_MS);
}
