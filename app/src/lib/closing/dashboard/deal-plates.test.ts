import { describe, expect, it } from "vitest";

import { dealPlates, formatClock } from "./deal-plates";

const doc = (n: number, pricing: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({
    pageNumber: i + 1,
    isPricing: pricing.includes(i + 1),
    summary: `Page ${i + 1}`,
  }));

describe("dealPlates", () => {
  it("gives each page its time, its heat and the reticle on the most-read one", () => {
    const result = dealPlates({
      pages: [
        { pageNumber: 1, totalDurationMs: 20_000, viewCount: 2 },
        { pageNumber: 3, totalDurationMs: 80_000, viewCount: 2 },
      ],
      documentPages: doc(4, [3]),
      numPages: 4,
      video: false,
      livePages: [3],
    });
    expect(result.plates.map((p) => p.label)).toEqual([
      "P.1",
      "P.2",
      "P.3",
      "P.4",
    ]);
    expect(result.plates[2]).toMatchObject({
      seconds: 80,
      avgSeconds: 40,
      heat: 1,
      pricing: true,
      summary: "Page 3",
      hottest: true,
      live: true,
    });
    expect(result.plates[0]).toMatchObject({
      seconds: 20,
      heat: 0.25,
      hottest: false,
      live: false,
    });
    expect(result.plates[1]).toMatchObject({
      seconds: 0,
      avgSeconds: null,
      heat: 0,
    });
    expect(result.totalSeconds).toBe(100);
  });

  it("folds a long document into page ranges, without per-page details", () => {
    const result = dealPlates({
      pages: [{ pageNumber: 26, totalDurationMs: 9_000, viewCount: 1 }],
      documentPages: doc(26, [25]),
      numPages: 26,
      video: false,
    });
    expect(result.pagesPerPlate).toBe(3);
    expect(result.plates).toHaveLength(9);
    expect(result.plates[8]).toMatchObject({
      label: "P.25–26",
      from: 25,
      to: 26,
      seconds: 9,
      pricing: true,
      summary: null,
      avgSeconds: null,
    });
  });

  it("names the tenths of a video pitch", () => {
    const result = dealPlates({
      pages: [],
      documentPages: doc(10),
      numPages: 10,
      video: true,
    });
    expect(result.plates[2].label).toBe("20–30 %");
    expect(result.hottest).toBeNull();
    expect(result.plates.every((p) => !p.hottest)).toBe(true);
  });
});

describe("formatClock", () => {
  it("reads like an instrument", () => {
    expect(formatClock(42)).toBe("0:42");
    expect(formatClock(218)).toBe("3:38");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});
