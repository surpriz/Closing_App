import { describe, expect, it } from "vitest";

import { isHotReader, rankSharedReaders } from "./hot-readers";

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
