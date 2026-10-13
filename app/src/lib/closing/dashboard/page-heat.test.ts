import { describe, expect, it } from "vitest";

import { MAX_PLATES, pageHeat } from "./page-heat";

describe("pageHeat", () => {
  it("scales each page against the most-read one", () => {
    const result = pageHeat(
      [
        { pageNumber: 1, durationMs: 10_000 },
        { pageNumber: 4, durationMs: 40_000 },
        { pageNumber: 4, durationMs: 20_000 },
      ],
      5,
    );
    expect(result.heats).toEqual([1 / 6, 0, 0, 1, 0]);
    expect(result.hottest).toEqual({ page: 4, seconds: 60, plate: 3 });
  });

  it("is all cold, with no hottest page, when nothing was read", () => {
    expect(pageHeat([], 3)).toEqual({ heats: [0, 0, 0], pagesPerPlate: 1, hottest: null });
  });

  it("folds long documents into buckets", () => {
    const result = pageHeat([{ pageNumber: 30, durationMs: 5_000 }], 30);
    expect(result.heats).toHaveLength(MAX_PLATES - 2);
    expect(result.pagesPerPlate).toBe(3);
    expect(result.hottest?.plate).toBe(9);
  });

  it("covers pages read past an unknown page count", () => {
    expect(pageHeat([{ pageNumber: 2, durationMs: 1_000 }], null).heats).toEqual([0, 1]);
  });
});
