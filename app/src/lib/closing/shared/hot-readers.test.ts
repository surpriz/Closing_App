import { describe, expect, it } from "vitest";

import { groupReadersByAddress, isHotReader, rankSharedReaders } from "./hot-readers";

const reader = (linkId: string, readingSec: number, pricingSec: number, minutesAgo: number) => ({
  linkId,
  readingMs: readingSec * 1000,
  pricingMs: pricingSec * 1000,
  lastActivityAt: new Date(Date.UTC(2026, 9, 12, 12) - minutesAgo * 60_000),
});

describe("isHotReader", () => {
  it("is hot past the threshold on pricing or on the whole document", () => {
    expect(isHotReader(reader("a", 20, 90, 0), 90)).toBe(true);
    expect(isHotReader(reader("a", 95, 0, 0), 90)).toBe(true);
    expect(isHotReader(reader("a", 89, 40, 0), 90)).toBe(false);
  });
});

describe("rankSharedReaders", () => {
  it("puts hot readers first, the longest on pricing on top", () => {
    const ranked = rankSharedReaders(
      [reader("cold-recent", 10, 0, 1), reader("hot-doc", 200, 0, 30), reader("hot-pricing", 100, 95, 60)],
      90,
    );
    expect(ranked.map((r) => [r.linkId, r.hot])).toEqual([
      ["hot-pricing", true],
      ["hot-doc", true],
      ["cold-recent", false],
    ]);
  });

  it("keeps the others by latest activity", () => {
    const ranked = rankSharedReaders([reader("older", 5, 0, 50), reader("newer", 5, 0, 5)], 90);
    expect(ranked.map((r) => r.linkId)).toEqual(["newer", "older"]);
  });
});

describe("groupReadersByAddress", () => {
  const at = (minutesAgo: number) => new Date(Date.UTC(2026, 9, 28, 12, 0) - minutesAgo * 60_000);
  const row = (linkId: string, email: string | null, readingMs: number, minutesAgo: number) => ({
    linkId,
    email,
    readingMs,
    pricingMs: 0,
    lastActivityAt: at(minutesAgo),
  });

  it("adds up one person's browsers, led by the latest", () => {
    const [abel, ...rest] = groupReadersByAddress([
      row("phone", "Abel@Photoroom.com", 20_000, 30),
      row("laptop", "abel@photoroom.com", 40_000, 5),
    ]);
    expect(rest).toHaveLength(0);
    expect(abel).toMatchObject({ linkId: "laptop", readingMs: 60_000, links: 2 });
  });

  it("lets a decided or hotter link speak for the person, never a test", () => {
    const [person] = groupReadersByAddress([
      { ...row("signed", "abel@photoroom.com", 1, 60), dealStatus: "VALIDATED" },
      { ...row("phone", "abel@photoroom.com", 1, 1), dealStatus: "OPEN" },
      { ...row("test", "abel@photoroom.com", 1, 0), isOnboardingTest: true },
    ]);
    expect(person).toMatchObject({ linkId: "signed", links: 3 });
  });

  it("keeps readers without an address apart", () => {
    expect(groupReadersByAddress([row("a", null, 1, 1), row("b", null, 1, 2)])).toHaveLength(2);
  });
});
