import { describe, expect, it } from "vitest";

import { HELP_USER_DAILY_MAX, HELP_USER_HOURLY_MAX } from "./constants";
import { decideHelpQuota } from "./quota";

describe("decideHelpQuota", () => {
  const ok = { lastHour: 0, lastDay: 0, budgetAllowed: true };

  it("lets a question through under every limit", () => {
    expect(decideHelpQuota(ok)).toBeNull();
  });

  it("stops at the hourly limit first", () => {
    expect(decideHelpQuota({ ...ok, lastHour: HELP_USER_HOURLY_MAX, lastDay: HELP_USER_DAILY_MAX })).toBe("help_hourly");
  });

  it("stops at the daily limit", () => {
    expect(decideHelpQuota({ ...ok, lastDay: HELP_USER_DAILY_MAX })).toBe("help_daily");
  });

  it("stops when the budget is spent", () => {
    expect(decideHelpQuota({ ...ok, budgetAllowed: false })).toBe("help_budget");
  });
});
