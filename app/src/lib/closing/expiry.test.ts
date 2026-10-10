import { describe, expect, it } from "vitest";

import { findInventedDates } from "./ai/guard";
import {
  deadlineSourceText,
  endOfLocalDay,
  expiryError,
  expiryFromPreset,
  expiryReminderKey,
  expiryReminderPlan,
  extendExpiry,
  formatCountdown,
  isLinkExpired,
  reactivates,
  showsCountdown,
} from "./expiry";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const UNITS = { d: "j", h: "h", min: "min", s: "s" };
const PARIS = "Europe/Paris";
const HOURS = { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] };

describe("showsCountdown", () => {
  it("counts down on quotes and proposals only", () => {
    expect(showsCountdown("QUOTE")).toBe(true);
    expect(showsCountdown("PROPOSAL")).toBe(true);
    expect(showsCountdown("PRESENTATION")).toBe(false);
    expect(showsCountdown("CONTRACT")).toBe(false);
    expect(showsCountdown(null)).toBe(false);
  });
});

describe("isLinkExpired", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("is expired from the very instant of the deadline", () => {
    expect(isLinkExpired({ expiresAt: now }, now)).toBe(true);
    expect(isLinkExpired({ expiresAt: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(isLinkExpired({ expiresAt: null }, now)).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("shows days and hours from three days", () => {
    expect(formatCountdown(3 * DAY + 4 * HOUR + 59_000, UNITS)).toBe("3 j 4 h");
  });

  it("shows hours and minutes under three days", () => {
    expect(formatCountdown(72 * HOUR - 1000, UNITS)).toBe("71h 59min");
    expect(formatCountdown(47 * HOUR + 12 * 60_000, UNITS)).toBe("47h 12min");
  });

  it("shows minutes and seconds in the last hour", () => {
    expect(formatCountdown(12 * 60_000 + 5000, UNITS)).toBe("12min 05s");
    expect(formatCountdown(0, UNITS)).toBe("0min 00s");
    expect(formatCountdown(-5000, UNITS)).toBe("0min 00s");
  });
});

describe("setting a date", () => {
  const now = new Date("2026-10-10T08:00:00Z");

  it("ends a picked day at 23:59 where the seller lives", () => {
    expect(endOfLocalDay("2026-10-17", PARIS)?.toISOString()).toBe("2026-10-17T21:59:00.000Z");
    // Winter time from October 25 in Paris
    expect(endOfLocalDay("2026-10-26", PARIS)?.toISOString()).toBe("2026-10-26T22:59:00.000Z");
    expect(endOfLocalDay("17/10/2026", PARIS)).toBeNull();
  });

  it("keeps 48h exact and ends day presets in the evening", () => {
    expect(expiryFromPreset("48h", now, PARIS).toISOString()).toBe("2026-10-12T08:00:00.000Z");
    expect(expiryFromPreset("7d", now, PARIS).toISOString()).toBe("2026-10-17T21:59:00.000Z");
  });

  it("extends from the current date, or from now once it has passed", () => {
    const future = new Date(now.getTime() + DAY);
    expect(extendExpiry(future, now, 7).getTime()).toBe(future.getTime() + 7 * DAY);
    expect(extendExpiry(new Date(now.getTime() - DAY), now, 3).getTime()).toBe(now.getTime() + 3 * DAY);
    expect(extendExpiry(null, now, 3).getTime()).toBe(now.getTime() + 3 * DAY);
  });

  it("refuses a past date or one more than a year ahead", () => {
    expect(expiryError(new Date(now.getTime() - 1), now)).toBe("Choisissez une date à venir.");
    expect(expiryError(new Date(now.getTime() + 400 * DAY), now)).toBe("Un an maximum.");
    expect(expiryError(new Date(now.getTime() + DAY), now)).toBeNull();
    expect(expiryError(new Date("nope"), now)).toBe("Choisissez une date à venir.");
  });

  it("reactivates only a link that was locked and opens again", () => {
    const past = new Date(now.getTime() - HOUR);
    const later = new Date(now.getTime() + DAY);
    expect(reactivates(past, later, now)).toBe(true);
    expect(reactivates(past, null, now)).toBe(true);
    expect(reactivates(later, new Date(later.getTime() + DAY), now)).toBe(false);
    expect(reactivates(null, later, now)).toBe(false);
    expect(reactivates(past, new Date(now.getTime() - 1), now)).toBe(false);
  });
});

describe("expiryReminderPlan", () => {
  // Monday October 12, 2026, 10:00 in Paris
  const monday = new Date("2026-10-12T08:00:00Z");
  const sentLongAgo = new Date("2026-10-01T08:00:00Z");
  const plan = (now: Date, expiresAt: Date, sentAt: Date | null = sentLongAgo) =>
    expiryReminderPlan({ now, expiresAt, sentAt, timezone: PARIS, hours: HOURS });

  it("waits until three days before", () => {
    expect(plan(monday, new Date(monday.getTime() + 5 * DAY))).toEqual({ kind: "wait" });
  });

  it("aims at two days before, in business hours", () => {
    // Tuesday 10:00, expires Thursday 18:00 Paris: Tuesday 18:00 is closed, Wednesday 9:00 is the slot
    const tuesday = new Date("2026-10-13T08:00:00Z");
    const result = plan(tuesday, new Date("2026-10-15T16:00:00Z"));
    expect(result).toEqual({ kind: "queue", scheduledFor: new Date("2026-10-14T07:00:00Z") });
  });

  it("falls back to the next slot when two days before is a weekend", () => {
    // Expires Monday 19 at 9:00: two days before is Saturday, Friday 16 is still useful
    const friday = new Date("2026-10-16T08:00:00Z");
    const result = plan(friday, new Date("2026-10-19T07:00:00Z"));
    expect(result).toEqual({ kind: "queue", scheduledFor: friday });
  });

  it("reminds at once when the date was set close", () => {
    expect(plan(monday, new Date(monday.getTime() + 30 * HOUR))).toEqual({ kind: "queue", scheduledFor: monday });
  });

  it("skips when the deadline is too close to be useful", () => {
    expect(plan(monday, new Date(monday.getTime() + 10 * HOUR))).toEqual({ kind: "skip", reason: "too_close" });
  });

  it("does not remind right after the proposal was sent", () => {
    expect(plan(monday, new Date(monday.getTime() + 20 * HOUR), new Date(monday.getTime() - HOUR))).toEqual({
      kind: "skip",
      reason: "too_close",
    });
  });

  it("skips expired and unsent links", () => {
    expect(plan(monday, new Date(monday.getTime() - 1))).toEqual({ kind: "skip", reason: "expired" });
    expect(plan(monday, new Date(monday.getTime() + DAY), null)).toEqual({ kind: "skip", reason: "not_sent" });
  });
});

describe("dedupe keys", () => {
  it("change with the date, so an extension re-arms the reminder", () => {
    const a = expiryReminderKey("l1", new Date("2026-10-15T16:00:00Z"), "p1");
    const b = expiryReminderKey("l1", new Date("2026-10-22T16:00:00Z"), "p1");
    expect(a).not.toBe(b);
  });
});

describe("deadlineSourceText", () => {
  it("lets the writer quote the real date in French and English", () => {
    const source = deadlineSourceText(new Date("2026-10-15T16:00:00Z"), PARIS);
    expect(findInventedDates("Valable jusqu'au 15 octobre.", source)).toEqual([]);
    expect(findInventedDates("Available until 15 October.", source)).toEqual([]);
    expect(findInventedDates("Valable jusqu'au 16 octobre.", source)).toEqual(["16 octobre"]);
  });
});
