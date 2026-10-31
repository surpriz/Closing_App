import { describe, expect, it } from "vitest";

import { isOutreachAllowed, isOutreachOrg, outreachOrgIds } from "./flag";

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

  it("parses the list, and an unset one is empty", () => {
    expect(outreachOrgIds({ OUTREACH_ORG_IDS: " org-a, ,org-b " })).toEqual(["org-a", "org-b"]);
    expect(outreachOrgIds({})).toEqual([]);
  });

  it("refuses everyone when the list is empty", () => {
    expect(isOutreachAllowed(verified, "org-a", { orgIds: "" })).toBe(false);
    expect(isOutreachAllowed(verified, "", { orgIds: "" })).toBe(false);
  });

  it("lets every verified workspace in on `*`, and reports no filter", () => {
    expect(outreachOrgIds({ OUTREACH_ORG_IDS: " * " })).toBeUndefined();
    expect(isOutreachOrg("org-z", { OUTREACH_ORG_IDS: "*" })).toBe(true);
    expect(isOutreachAllowed(verified, "org-z", { orgIds: "*" })).toBe(true);
    expect(isOutreachAllowed({ emailVerified: false }, "org-z", { orgIds: "*" })).toBe(false);
  });

  it("does not read `*` inside a list as a wildcard", () => {
    expect(isOutreachOrg("org-z", { OUTREACH_ORG_IDS: "org-a, *" })).toBe(false);
  });
});
