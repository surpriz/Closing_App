import { describe, expect, it } from "vitest";

import { formatReadTime, readingsByDocument } from "./document-heat";
import { pageHeat } from "./page-heat";

describe("readingsByDocument", () => {
  it("folds every link's pages into its document", () => {
    const byLink = new Map([
      ["l1", [{ pageNumber: 1, durationMs: 1000 }]],
      ["l2", [{ pageNumber: 1, durationMs: 3000 }, { pageNumber: 2, durationMs: 500 }]],
      ["l3", [{ pageNumber: 4, durationMs: 2000 }]],
    ]);
    const documentOf = new Map([
      ["l1", "d1"],
      ["l2", "d1"],
      ["l3", "d2"],
    ]);
    const result = readingsByDocument(byLink, documentOf);
    expect(result.get("d1")).toHaveLength(3);
    expect(result.get("d2")).toEqual([{ pageNumber: 4, durationMs: 2000 }]);
    // pageHeat sums the same page across links
    expect(pageHeat(result.get("d1")!, 2).hottest).toEqual({ page: 1, seconds: 4, plate: 0 });
  });

  it("drops links it cannot place", () => {
    const result = readingsByDocument(new Map([["lost", [{ pageNumber: 1, durationMs: 10 }]]]), new Map());
    expect(result.size).toBe(0);
  });
});

describe("formatReadTime", () => {
  it("reads like an instrument", () => {
    expect(formatReadTime(42)).toBe("42 s");
    expect(formatReadTime(188)).toBe("3 min 08");
    expect(formatReadTime(-3)).toBe("0 s");
  });
});
