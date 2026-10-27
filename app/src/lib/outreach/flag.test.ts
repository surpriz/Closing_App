import { describe, expect, it } from "vitest";

import { isOutreachAllowed } from "./flag";

const verified = { emailVerified: true };

describe("isOutreachAllowed", () => {
  it("lets any verified member of a listed workspace in, spaces around ids included", () => {
    expect(isOutreachAllowed(verified, "org-b", { orgIds: "org-a, org-b" })).toBe(true);
  });

  it("refuses a workspace that is not listed", () => {
    expect(isOutreachAllowed(verified, "org-c", { orgIds: "org-a, org-b" })).toBe(false);
  });

  it("refuses an unverified email", () => {
    expect(isOutreachAllowed({ emailVerified: false }, "org-a", { orgIds: "org-a" })).toBe(false);
  });

  it("refuses everyone when the list is empty", () => {
    expect(isOutreachAllowed(verified, "org-a", { orgIds: "" })).toBe(false);
    expect(isOutreachAllowed(verified, "", { orgIds: "" })).toBe(false);
  });
});
