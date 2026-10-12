import { describe, expect, it } from "vitest";

import { bracketOf, formatHeadcountRange, headcountRanges } from "./headcount";

describe("headcountRanges", () => {
  it("merges contiguous brackets", () => {
    expect(headcountRanges(["12", "11", "32"])).toEqual([
      { min: 10, max: 49 },
      { min: 250, max: 499 },
    ]);
  });

  it("ignores unusable codes", () => {
    expect(headcountRanges(["NN", "00"])).toEqual([]);
    expect(bracketOf("NN")).toBeNull();
  });

  it("formats an open range", () => {
    expect(formatHeadcountRange({ min: 10000, max: null })).toBe("10000+ salariés");
  });
});
