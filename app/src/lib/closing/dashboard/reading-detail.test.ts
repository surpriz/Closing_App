import { describe, expect, it } from "vitest";

import { showsReadingDetail } from "./reading-detail";

describe("showsReadingDetail", () => {
  it("shows the page chart once two pages got time", () => {
    expect(showsReadingDetail({ kind: "FILE", durationMs: null, viewCount: 1, pagesWithTime: 2 })).toBe(true);
    expect(showsReadingDetail({ kind: "FILE", durationMs: null, viewCount: 1, pagesWithTime: 1 })).toBe(false);
    expect(showsReadingDetail({ kind: "FILE", durationMs: null, viewCount: 0, pagesWithTime: 2 })).toBe(false);
  });

  it("shows the video chart only for a watched video of 30 s or more", () => {
    expect(showsReadingDetail({ kind: "VIDEO", durationMs: 30_000, viewCount: 1, pagesWithTime: 1 })).toBe(true);
    expect(showsReadingDetail({ kind: "VIDEO", durationMs: 4_000, viewCount: 3, pagesWithTime: 5 })).toBe(false);
    expect(showsReadingDetail({ kind: "VIDEO", durationMs: 90_000, viewCount: 0, pagesWithTime: 0 })).toBe(false);
  });

  it("never shows it for a web link", () => {
    expect(showsReadingDetail({ kind: "URL", durationMs: null, viewCount: 9, pagesWithTime: 9 })).toBe(false);
  });
});
