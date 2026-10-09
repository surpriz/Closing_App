import { describe, expect, it } from "vitest";

import { detectCallMoment, type CallMomentFacts } from "./call-moment";

const quiet: CallMomentFacts = {
  liveReaders: 1,
  multiViewerThreshold: 2,
  committeeThreshold: 3,
  firstOpen: false,
  inactiveDays: 0,
  reopenAfterDays: 3,
  pricingSeconds: null,
  pricingThresholdSec: 90,
  aiPriority: null,
};

describe("detectCallMoment", () => {
  it("ignores an ordinary rereading", () => {
    expect(detectCallMoment(quiet)).toBeNull();
    expect(detectCallMoment({ ...quiet, aiPriority: 3 })).toBeNull();
  });

  it("flags the first opening", () => {
    expect(detectCallMoment({ ...quiet, firstOpen: true, inactiveDays: null })?.reason).toBe("first_open");
  });

  it("flags a return after a silence, with the number of days", () => {
    expect(detectCallMoment({ ...quiet, inactiveDays: 5 })).toEqual({
      reason: "reopened",
      detail: "Revient après 5 jours sans lecture",
    });
  });

  it("flags pricing pages read past the threshold", () => {
    expect(detectCallMoment({ ...quiet, pricingSeconds: 89 })).toBeNull();
    expect(detectCallMoment({ ...quiet, pricingSeconds: 90 })?.reason).toBe("pricing");
  });

  it("puts several readers first", () => {
    expect(detectCallMoment({ ...quiet, liveReaders: 3, committeeThreshold: 5, firstOpen: true })?.reason).toBe("multi_viewer");
  });

  it("leaves a committee to the committee alert", () => {
    expect(detectCallMoment({ ...quiet, liveReaders: 3, firstOpen: true })?.reason).toBe("first_open");
    expect(detectCallMoment({ ...quiet, liveReaders: 4 })).toBeNull();
  });

  it("flags a deal the analysis rates urgent", () => {
    expect(detectCallMoment({ ...quiet, aiPriority: 4 })?.reason).toBe("hot_deal");
  });
});
