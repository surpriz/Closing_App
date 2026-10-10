import { describe, expect, it } from "vitest";

import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("marie.martin@acme.com")).toBe("m•••@acme.com");
    expect(maskEmail("a@b.fr")).toBe("a•••@b.fr");
  });

  it("hides anything that is not an address", () => {
    expect(maskEmail("nope")).toBe("•••");
  });
});
