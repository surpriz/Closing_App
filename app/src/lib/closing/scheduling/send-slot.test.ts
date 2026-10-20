import { describe, expect, it } from "vitest";

import { getLocalParts } from "./business-hours";
import { habitualHour, jitterMinutes, nextSendSlot } from "./send-slot";

const hours = { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] };
const PARIS = "Europe/Paris";
const local = (date: Date) => getLocalParts(date, PARIS);

describe("habitual hour", () => {
  const at = (iso: string) => ({ at: new Date(iso), timeZone: PARIS });

  it("takes the hour most readings started at, inside business hours", () => {
    const readings = [at("2026-10-12T12:10:00Z"), at("2026-10-13T12:40:00Z"), at("2026-10-14T07:05:00Z"), at("2026-10-14T21:00:00Z")];
    expect(habitualHour(readings, hours, 2)).toBe(14);
  });

  it("needs enough readings to call it a habit", () => {
    expect(habitualHour([at("2026-10-12T12:10:00Z")], hours, 2)).toBeNull();
    expect(habitualHour([at("2026-10-12T20:10:00Z"), at("2026-10-13T20:10:00Z")], hours, 2)).toBeNull();
  });

  it("prefers the morning on a tie", () => {
    expect(habitualHour([at("2026-10-12T13:00:00Z"), at("2026-10-13T08:00:00Z")], hours, 2)).toBe(10);
  });
});

describe("send slot", () => {
  it("keeps the old behaviour without habit or seed", () => {
    const from = new Date("2026-10-13T08:00:00Z"); // Tuesday 10:00 in Paris
    expect(nextSendSlot(from, PARIS, hours, "asap", null, null)).toEqual(from);
  });

  it("lands at the habitual hour, a few minutes past it", () => {
    const from = new Date("2026-10-13T08:00:00Z"); // Tuesday 10:00
    const slot = nextSendSlot(from, PARIS, hours, "next-morning", 14, "seed");
    expect(local(slot)).toMatchObject({ day: 14, hour: 14, minute: jitterMinutes("seed") });
  });

  it("waits for the habitual hour later the same day, or takes the next business day", () => {
    const morning = new Date("2026-10-13T07:30:00Z"); // Tuesday 9:30
    expect(local(nextSendSlot(morning, PARIS, hours, "asap", 14, "s"))).toMatchObject({ day: 13, hour: 14 });
    const friday = new Date("2026-10-16T14:00:00Z"); // Friday 16:00
    expect(local(nextSendSlot(friday, PARIS, hours, "asap", 11, "s"))).toMatchObject({ day: 19, hour: 11 });
  });

  it("moves off 9:00 sharp at opening time", () => {
    const night = new Date("2026-10-13T20:00:00Z"); // Tuesday 22:00
    const slot = nextSendSlot(night, PARIS, hours, "asap", null, "seed");
    expect(local(slot)).toMatchObject({ day: 14, hour: 9 });
    expect(local(slot).minute).toBeGreaterThan(0);
  });

  it("spreads minutes but keeps them stable for one message", () => {
    expect(jitterMinutes("a")).toBe(jitterMinutes("a"));
    for (const seed of ["a", "b", "c", "d"]) {
      expect(jitterMinutes(seed)).toBeGreaterThanOrEqual(4);
      expect(jitterMinutes(seed)).toBeLessThan(40);
    }
  });
});
