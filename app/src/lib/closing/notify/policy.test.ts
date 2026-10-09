import { describe, expect, it } from "vitest";

import { DEFAULT_PREFS, decideChannels, isExtensionActive, MAX_CALL_ALERTS_PER_HOUR } from "./policy";

// Thursday 8 Oct 2026, 10:00 and 22:00 in Paris
const DAY = new Date("2026-10-08T08:00:00Z");
const NIGHT = new Date("2026-10-08T20:00:00Z");
const SATURDAY = new Date("2026-10-10T08:00:00Z");

const base = {
  prefs: DEFAULT_PREFS,
  workspaceChannels: [] as ("EMAIL" | "SLACK" | "WEBHOOK")[],
  now: DAY,
  timezone: "Europe/Paris",
  extensionActive: false,
  recentCallAlerts: 0,
};

describe("decideChannels", () => {
  it("emails the seller when the prospect validates, even at night", () => {
    expect(decideChannels({ ...base, type: "PROSPECT_VALIDATED", now: NIGHT }).channels).toEqual(["EMAIL", "EXTENSION"]);
  });

  it("adds team channels to prospect actions, never the workspace EMAIL flag", () => {
    const { channels } = decideChannels({
      ...base,
      type: "CHANGE_REQUESTED",
      prefs: { ...DEFAULT_PREFS, emailActions: false },
      workspaceChannels: ["EMAIL", "SLACK", "WEBHOOK"],
    });
    expect(channels).toEqual(["EXTENSION", "SLACK", "WEBHOOK"]);
  });

  it("sends call moments to the extension only by default", () => {
    expect(decideChannels({ ...base, type: "CALL_MOMENT" })).toEqual({ channels: ["EXTENSION"], reason: "ok" });
  });

  it("emails a call moment only when asked and the extension is not running", () => {
    const prefs = { ...DEFAULT_PREFS, emailCallMoments: true };
    expect(decideChannels({ ...base, type: "CALL_MOMENT", prefs }).channels).toEqual(["EXTENSION", "EMAIL"]);
    expect(decideChannels({ ...base, type: "CALL_MOMENT", prefs, extensionActive: true }).channels).toEqual(["EXTENSION"]);
  });

  it("treats reader alerts like call moments: live, quiet at night", () => {
    for (const type of ["COMMITTEE_LIVE", "NEW_READER", "DECISION_MAKER_DETECTED"] as const) {
      expect(decideChannels({ ...base, type })).toEqual({ channels: ["EXTENSION"], reason: "ok" });
      expect(decideChannels({ ...base, type, now: NIGHT }).reason).toBe("quiet_hours");
    }
  });

  it("keeps call moments and drafts quiet at night and on weekends", () => {
    expect(decideChannels({ ...base, type: "CALL_MOMENT", now: NIGHT }).reason).toBe("quiet_hours");
    expect(decideChannels({ ...base, type: "MULTI_VIEWER", now: SATURDAY }).channels).toEqual([]);
    expect(decideChannels({ ...base, type: "DRAFT_READY", now: NIGHT }).channels).toEqual([]);
  });

  it("stops call moments past the hourly cap", () => {
    const decision = decideChannels({ ...base, type: "CALL_MOMENT", recentCallAlerts: MAX_CALL_ALERTS_PER_HOUR });
    expect(decision).toEqual({ channels: [], reason: "rate_limited" });
  });

  it("uses the seller's time zone", () => {
    // 22:00 in Paris is 13:00 in Los Angeles
    expect(decideChannels({ ...base, type: "CALL_MOMENT", now: NIGHT, timezone: "America/Los_Angeles" }).channels).toEqual([
      "EXTENSION",
    ]);
  });
});

describe("isExtensionActive", () => {
  it("is active for a few minutes after the last poll", () => {
    expect(isExtensionActive(new Date(DAY.getTime() - 60_000), DAY)).toBe(true);
    expect(isExtensionActive(new Date(DAY.getTime() - 10 * 60_000), DAY)).toBe(false);
    expect(isExtensionActive(null, DAY)).toBe(false);
  });
});
