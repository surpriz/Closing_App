import { describe, expect, it } from "vitest";

import { LIVE_READING_WINDOW_MS } from "../constants";
import { isReadingNow } from "./live-status";

const now = new Date("2026-09-30T10:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("isReadingNow", () => {
  it("is live right after a flush", () => {
    expect(isReadingNow({ lastSeenAt: ago(3_000), leftAt: null }, now)).toBe(true);
  });

  it("stops once flushes stop coming", () => {
    expect(isReadingNow({ lastSeenAt: ago(LIVE_READING_WINDOW_MS + 1), leftAt: null }, now)).toBe(false);
  });

  it("stops as soon as the tab is left", () => {
    expect(isReadingNow({ lastSeenAt: ago(1_000), leftAt: ago(1_000) }, now)).toBe(false);
  });
});
