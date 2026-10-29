import { describe, expect, it } from "vitest";

import { getLocalParts } from "@/lib/closing/scheduling/business-hours";

import { nextWindowSlots, sendWindow } from "./window";

const PARIS = "Europe/Paris";
const hours = { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] };
const local = (date: Date) => getLocalParts(date, PARIS);
const minutesOfDay = (date: Date) => local(date).hour * 60 + local(date).minute;
const at = (iso: string) => new Date(iso);

describe("sendWindow", () => {
  const input = { day: at("2026-10-27T10:00:00Z"), timeZone: PARIS, hours, seed: "mb1:2026-10-27" };

  it("is empty for a count of 0", () => {
    expect(sendWindow({ ...input, count: 0 })).toEqual([]);
  });

  it("returns count slots, sorted, all on the local day within [start, end)", () => {
    const slots = sendWindow({ ...input, count: 12 });
    expect(slots).toHaveLength(12);
    expect([...slots].sort((a, b) => a.getTime() - b.getTime())).toEqual(slots);
    for (const slot of slots) {
      expect(local(slot).day).toBe(27);
      expect(minutesOfDay(slot)).toBeGreaterThanOrEqual(9 * 60);
      expect(minutesOfDay(slot)).toBeLessThan(18 * 60);
    }
  });

  it("spreads them over the whole window, not bunched at one end", () => {
    const slots = sendWindow({ ...input, count: 8 });
    expect(minutesOfDay(slots[0])).toBeLessThan(11 * 60);
    expect(minutesOfDay(slots[7])).toBeGreaterThan(16 * 60);
    // Nominal gap is 67.5 min, jitter moves each slot by at most 18: gaps stay between 30 and 105
    for (let i = 1; i < slots.length; i++) {
      const gap = (slots[i].getTime() - slots[i - 1].getTime()) / 60_000;
      expect(gap).toBeGreaterThan(30);
      expect(gap).toBeLessThan(105);
    }
  });

  it("keeps a crowded day inside the window (clamped, not spilling over)", () => {
    const slots = sendWindow({ ...input, count: 200 });
    expect(slots).toHaveLength(200);
    expect(minutesOfDay(slots[0])).toBeGreaterThanOrEqual(9 * 60);
    expect(minutesOfDay(slots[199])).toBeLessThan(18 * 60);
  });

  it("is deterministic per seed and changes with it", () => {
    const a = sendWindow({ ...input, count: 6 });
    expect(sendWindow({ ...input, count: 6 })).toEqual(a);
    expect(sendWindow({ ...input, count: 6, seed: "mb2:2026-10-27" })).not.toEqual(a);
  });

  it("moves a weekend day to the next business day", () => {
    const slots = sendWindow({ ...input, day: at("2026-10-24T10:00:00Z"), count: 4 }); // Saturday
    expect(slots.map((s) => local(s).day)).toEqual([26, 26, 26, 26]);
    expect(local(slots[0]).weekday).toBe(1);
  });

  it("takes the local day of `day`: 23:30 UTC on Sunday is already Monday in Paris", () => {
    const slots = sendWindow({ ...input, day: at("2026-10-25T23:30:00Z"), count: 3 });
    expect(slots.every((s) => local(s).day === 26)).toBe(true);
  });

  it("uses local wall-clock hours on both sides of the DST change", () => {
    const summer = sendWindow({ ...input, day: at("2026-10-23T10:00:00Z"), count: 5 }); // CEST, UTC+2
    const winter = sendWindow({ ...input, day: at("2026-10-27T10:00:00Z"), count: 5 }); // CET, UTC+1
    for (const slot of [...summer, ...winter]) {
      expect(minutesOfDay(slot)).toBeGreaterThanOrEqual(9 * 60);
      expect(minutesOfDay(slot)).toBeLessThan(18 * 60);
    }
    // Monday 26 Oct is the first day on winter time, the day after the change
    const monday = sendWindow({ ...input, day: at("2026-10-26T10:00:00Z"), count: 1 })[0];
    expect(local(monday).day).toBe(26);
  });
});

describe("nextWindowSlots", () => {
  const args = (from: string, count: number) => [at(from), PARIS, hours, count, "mb1"] as const;

  it("returns count slots, all strictly after `from`, sorted", () => {
    const from = at("2026-10-27T11:00:00Z"); // 12:00 Paris
    const slots = nextWindowSlots(from, PARIS, hours, 5, "mb1");
    expect(slots).toHaveLength(5);
    for (const slot of slots) expect(slot.getTime()).toBeGreaterThan(from.getTime());
    expect([...slots].sort((a, b) => a.getTime() - b.getTime())).toEqual(slots);
  });

  it("keeps today's remaining slots then completes on the next business day", () => {
    const slots = nextWindowSlots(...args("2026-10-27T13:00:00Z", 8)); // 14:00 Paris
    const days = slots.map((s) => local(s).day);
    expect(slots).toHaveLength(8);
    expect(days[0]).toBe(27);
    expect(days.at(-1)).toBe(28);
  });

  it("starts at the next business day when `from` is at the end of the day", () => {
    const slots = nextWindowSlots(...args("2026-10-27T17:30:00Z", 3)); // 18:30 Paris
    expect(slots.every((s) => local(s).day === 28)).toBe(true);
    expect(slots).toHaveLength(3);
  });

  it("skips the weekend", () => {
    const slots = nextWindowSlots(...args("2026-10-23T17:30:00Z", 3)); // Friday 19:30 Paris
    expect(slots.every((s) => local(s).day === 26 && local(s).weekday === 1)).toBe(true);
  });

  it("starts the next day when `from` is a Saturday", () => {
    const slots = nextWindowSlots(...args("2026-10-24T08:00:00Z", 2));
    expect(slots.map((s) => local(s).weekday)).toEqual([1, 1]);
  });

  it("is deterministic and empty for a count of 0", () => {
    expect(nextWindowSlots(...args("2026-10-27T07:00:00Z", 4))).toEqual(nextWindowSlots(...args("2026-10-27T07:00:00Z", 4)));
    expect(nextWindowSlots(...args("2026-10-27T07:00:00Z", 0))).toEqual([]);
  });

  it("gives the next day its own jitter", () => {
    const next = nextWindowSlots(...args("2026-10-27T17:30:00Z", 3)).map(minutesOfDay);
    const after = nextWindowSlots(...args("2026-10-28T17:30:00Z", 3)).map(minutesOfDay);
    expect(next).not.toEqual(after);
  });
});
