import { describe, expect, it } from "vitest";

import { nextBusinessSlot, zonedTimeToUtc } from "./business-hours";

const HOURS = { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] };

describe("zonedTimeToUtc", () => {
  it("converts Paris summer time (UTC+2)", () => {
    expect(zonedTimeToUtc(2026, 9, 15, 9, 0, "Europe/Paris").toISOString()).toBe("2026-09-15T07:00:00.000Z");
  });

  it("converts Paris winter time (UTC+1)", () => {
    expect(zonedTimeToUtc(2026, 12, 15, 9, 0, "Europe/Paris").toISOString()).toBe("2026-12-15T08:00:00.000Z");
  });

  it("handles the day after the DST switch in New York", () => {
    // DST ends Sunday 1 Nov 2026 in the US
    expect(zonedTimeToUtc(2026, 11, 2, 9, 0, "America/New_York").toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });
});

describe("nextBusinessSlot", () => {
  it("next-morning from a Monday evening in Paris is Tuesday 9:00 Paris", () => {
    const mondayEvening = new Date("2026-09-14T18:30:00Z"); // 20:30 Paris
    expect(nextBusinessSlot(mondayEvening, "Europe/Paris", HOURS, "next-morning").toISOString()).toBe(
      "2026-09-15T07:00:00.000Z",
    );
  });

  it("next-morning skips the weekend", () => {
    const fridayAfternoon = new Date("2026-09-18T13:00:00Z"); // Friday 15:00 Paris
    expect(nextBusinessSlot(fridayAfternoon, "Europe/Paris", HOURS, "next-morning").toISOString()).toBe(
      "2026-09-21T07:00:00.000Z",
    );
  });

  it("uses the prospect timezone, not the server one", () => {
    const mondayEveningParis = new Date("2026-09-14T18:30:00Z"); // 14:30 in Montreal
    expect(nextBusinessSlot(mondayEveningParis, "America/Toronto", HOURS, "next-morning").toISOString()).toBe(
      "2026-09-15T13:00:00.000Z",
    );
  });

  it("asap returns now during business hours", () => {
    const tuesdayMorning = new Date("2026-09-15T08:00:00Z"); // 10:00 Paris
    expect(nextBusinessSlot(tuesdayMorning, "Europe/Paris", HOURS, "asap")).toEqual(tuesdayMorning);
  });

  it("asap before opening waits for 9:00 the same day", () => {
    const tuesdayEarly = new Date("2026-09-15T04:00:00Z"); // 06:00 Paris
    expect(nextBusinessSlot(tuesdayEarly, "Europe/Paris", HOURS, "asap").toISOString()).toBe(
      "2026-09-15T07:00:00.000Z",
    );
  });

  it("asap on Saturday waits for Monday", () => {
    const saturday = new Date("2026-09-19T10:00:00Z");
    expect(nextBusinessSlot(saturday, "Europe/Paris", HOURS, "asap").toISOString()).toBe("2026-09-21T07:00:00.000Z");
  });
});
