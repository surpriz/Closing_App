import { describe, expect, it } from "vitest";

import { dailyAllowance, localDayKey, mailboxAgeDays, remainingToday } from "./allowance";

const PARIS = "Europe/Paris";
const start = new Date("2026-10-01T08:00:00Z");
const box = { rampStartedAt: start, dailyCap: 40, timezone: PARIS };
const at = (iso: string) => new Date(iso);

describe("localDayKey", () => {
  it("is the calendar day in the mailbox's zone, not in UTC", () => {
    expect(localDayKey(at("2026-10-27T22:30:00Z"), PARIS)).toBe("2026-10-27");
    expect(localDayKey(at("2026-10-27T23:30:00Z"), PARIS)).toBe("2026-10-28");
    expect(localDayKey(at("2026-01-05T23:30:00Z"), PARIS)).toBe("2026-01-06");
  });
});

describe("mailboxAgeDays", () => {
  it("counts the connection day as day 1", () => {
    expect(mailboxAgeDays(start, PARIS, at("2026-10-01T20:00:00Z"))).toBe(1);
    expect(mailboxAgeDays(start, PARIS, at("2026-10-08T08:00:00Z"))).toBe(8);
  });

  it("turns over at local midnight (23:30 UTC is already tomorrow in Paris)", () => {
    expect(mailboxAgeDays(start, PARIS, at("2026-10-01T21:59:00Z"))).toBe(1);
    expect(mailboxAgeDays(start, PARIS, at("2026-10-01T22:00:00Z"))).toBe(2);
    expect(mailboxAgeDays(start, "UTC", at("2026-10-01T22:00:00Z"))).toBe(1);
  });

  it("counts calendar days across the October DST change (31 Oct -> 1 Nov is a 25 h day)", () => {
    const from = at("2026-10-24T10:00:00Z");
    expect(mailboxAgeDays(from, PARIS, at("2026-10-25T21:30:00Z"))).toBe(2);
    expect(mailboxAgeDays(from, PARIS, at("2026-10-25T23:30:00Z"))).toBe(3);
    expect(mailboxAgeDays(from, PARIS, at("2026-10-26T22:30:00Z"))).toBe(3);
    expect(mailboxAgeDays(from, PARIS, at("2026-10-26T23:00:00Z"))).toBe(4);
  });
});

describe("dailyAllowance", () => {
  const caps = { max: 100 };
  const onDay = (n: number) => at(`2026-10-${String(n).padStart(2, "0")}T12:00:00Z`);

  it("ramps up by steps", () => {
    expect(dailyAllowance(box, onDay(1), caps)).toBe(5);
    expect(dailyAllowance(box, onDay(7), caps)).toBe(5);
    expect(dailyAllowance(box, onDay(8), caps)).toBe(12);
    expect(dailyAllowance(box, onDay(14), caps)).toBe(12);
    expect(dailyAllowance(box, onDay(15), caps)).toBe(20);
    expect(dailyAllowance(box, onDay(21), caps)).toBe(20);
  });

  it("is the cap once the ramp is over", () => {
    expect(dailyAllowance(box, onDay(22), caps)).toBe(40);
    expect(dailyAllowance(box, at("2027-03-01T12:00:00Z"), caps)).toBe(40);
  });

  it("never exceeds the mailbox cap, even in the ramp", () => {
    expect(dailyAllowance({ ...box, dailyCap: 3 }, onDay(1), caps)).toBe(3);
    expect(dailyAllowance({ ...box, dailyCap: 15 }, onDay(15), caps)).toBe(15);
  });

  it("never exceeds the global max", () => {
    expect(dailyAllowance(box, onDay(22), { max: 25 })).toBe(25);
    expect(dailyAllowance(box, onDay(1), { max: 2 })).toBe(2);
  });
});

describe("remainingToday", () => {
  const caps = { max: 100 };
  const now = at("2026-10-08T12:00:00Z");

  it("subtracts what went out today", () => {
    expect(remainingToday({ ...box, sentDay: "2026-10-08", sentCount: 5 }, now, caps)).toBe(7);
  });

  it("ignores a count left over from another day", () => {
    expect(remainingToday({ ...box, sentDay: "2026-10-07", sentCount: 12 }, now, caps)).toBe(12);
    expect(remainingToday({ ...box, sentDay: null, sentCount: 0 }, now, caps)).toBe(12);
  });

  it("uses the local day, not the UTC one", () => {
    const late = at("2026-10-08T22:30:00Z"); // already the 9th in Paris
    expect(remainingToday({ ...box, sentDay: "2026-10-08", sentCount: 12 }, late, caps)).toBe(12);
  });

  it("is never negative", () => {
    expect(remainingToday({ ...box, sentDay: "2026-10-08", sentCount: 30 }, now, caps)).toBe(0);
  });
});
