import { HELP_USER_DAILY_MAX, HELP_USER_HOURLY_MAX } from "./constants";

/** Why a help question is refused before reaching the model. Pure. */
export const HELP_QUOTA_ERRORS = ["help_hourly", "help_daily", "help_budget"] as const;
export type HelpQuotaError = (typeof HELP_QUOTA_ERRORS)[number];

export function decideHelpQuota(input: {
  lastHour: number;
  lastDay: number;
  /** canHelp: the daily budget across all workspaces. */
  budgetAllowed: boolean;
}): HelpQuotaError | null {
  if (input.lastHour >= HELP_USER_HOURLY_MAX) return "help_hourly";
  if (input.lastDay >= HELP_USER_DAILY_MAX) return "help_daily";
  if (!input.budgetAllowed) return "help_budget";
  return null;
}
