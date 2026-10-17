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
    expect(detectCallMoment(quiet, "fr")).toBeNull();
    expect(detectCallMoment({ ...quiet, aiPriority: 3 }, "fr")).toBeNull();
  });

  it("flags the first opening", () => {
    expect(detectCallMoment({ ...quiet, firstOpen: true, inactiveDays: null }, "fr")?.reason).toBe("first_open");
  });

  it("flags a return after a silence, with the number of days", () => {
    expect(detectCallMoment({ ...quiet, inactiveDays: 5 }, "fr")).toEqual({
      reason: "reopened",
      detail: "Revient après 5 jours sans lecture",
    });
  });

  it("flags pricing pages read past the threshold", () => {
    expect(detectCallMoment({ ...quiet, pricingSeconds: 89 }, "fr")).toBeNull();
    expect(detectCallMoment({ ...quiet, pricingSeconds: 90 }, "fr")?.reason).toBe("pricing");
  });

  it("puts several readers first", () => {
    expect(detectCallMoment({ ...quiet, liveReaders: 3, committeeThreshold: 5, firstOpen: true }, "fr")?.reason).toBe("multi_viewer");
  });

  it("leaves a committee to the committee alert", () => {
    expect(detectCallMoment({ ...quiet, liveReaders: 3, firstOpen: true }, "fr")?.reason).toBe("first_open");
    expect(detectCallMoment({ ...quiet, liveReaders: 4 }, "fr")).toBeNull();
  });

  it("flags a deal the analysis rates urgent", () => {
    expect(detectCallMoment({ ...quiet, aiPriority: 4 }, "fr")?.reason).toBe("hot_deal");
  });
});
