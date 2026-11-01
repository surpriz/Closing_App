import { describe, expect, it } from "vitest";

import { enrollmentActions } from "./enrollment-actions";

const row = (over: Partial<Parameters<typeof enrollmentActions>[0]> = {}) => ({
  status: "ACTIVE" as const,
  linkId: "l1",
  blockedStep: false,
  ...over,
});

describe("enrollmentActions", () => {
  it("offers only the link on a read-only campaign", () => {
    expect(enrollmentActions(row(), true)).toEqual(["openLink"]);
    expect(enrollmentActions(row({ linkId: null }), true)).toEqual([]);
  });

  it("has nothing to offer on a finished prospect without a link: the menu must not open empty", () => {
    expect(enrollmentActions(row({ status: "REPLIED", linkId: null }), false)).toEqual([]);
  });

  it("lets the seller remove a queued prospect, and that is all", () => {
    expect(enrollmentActions(row({ status: "QUEUED", linkId: null }), false)).toEqual(["remove"]);
  });

  it("offers resend and skip only on a blocked active step, before pause and remove", () => {
    expect(enrollmentActions(row({ blockedStep: true }), false)).toEqual(["openLink", "resendStep", "skipStep", "pause", "remove"]);
    expect(enrollmentActions(row(), false)).toEqual(["openLink", "pause", "remove"]);
  });

  it("offers resume on a paused prospect", () => {
    expect(enrollmentActions(row({ status: "PAUSED" }), false)).toEqual(["openLink", "resume", "remove"]);
  });
});
