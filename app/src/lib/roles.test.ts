import { describe, expect, it } from "vitest";

import { isManagerRole, isOwnerRole } from "./roles";

describe("roles", () => {
  it("tells owners apart", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("admin")).toBe(false);
    expect(isOwnerRole("member, owner")).toBe(true);
  });

  it("counts owners and admins as managers", () => {
    expect(isManagerRole("owner")).toBe(true);
    expect(isManagerRole("admin")).toBe(true);
    expect(isManagerRole("admin,member")).toBe(true);
    expect(isManagerRole("member")).toBe(false);
    expect(isManagerRole("")).toBe(false);
  });
});
