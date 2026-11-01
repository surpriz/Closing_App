import { describe, expect, it } from "vitest";

import { followupDueNow } from "./due";

const now = new Date("2026-11-01T10:00:00Z");

describe("followupDueNow", () => {
  it("is due now once its suggested slot has passed: approving sends it at the next tick", () => {
    expect(followupDueNow(new Date("2026-10-30T08:12:00Z"), now)).toBe(true);
    expect(followupDueNow(now, now)).toBe(true);
  });

  it("keeps its slot while it is still ahead", () => {
    expect(followupDueNow(new Date("2026-11-02T08:12:00Z"), now)).toBe(false);
  });
});
