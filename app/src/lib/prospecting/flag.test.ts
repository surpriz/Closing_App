import { describe, expect, it } from "vitest";

import { isProspectingAllowed } from "./flag";

const config = { orgIds: "org-a, org-b", adminEmail: "boss@clozer.club" };
const admin = { email: "Boss@Clozer.club", emailVerified: true };

describe("isProspectingAllowed", () => {
  it("lets the platform admin in on a listed workspace", () => {
    expect(isProspectingAllowed(admin, "org-b", config)).toBe(true);
  });

  it("refuses a teammate of a listed workspace", () => {
    expect(isProspectingAllowed({ email: "seller@acme.fr", emailVerified: true }, "org-a", config)).toBe(false);
  });

  it("refuses the admin on a workspace that is not listed", () => {
    expect(isProspectingAllowed(admin, "org-c", config)).toBe(false);
  });

  it("refuses an unverified admin email", () => {
    expect(isProspectingAllowed({ ...admin, emailVerified: false }, "org-a", config)).toBe(false);
  });

  it("refuses everyone when no admin or no workspace is configured", () => {
    expect(isProspectingAllowed(admin, "org-a", { ...config, adminEmail: "" })).toBe(false);
    expect(isProspectingAllowed(admin, "", { ...config, orgIds: "" })).toBe(false);
  });
});
