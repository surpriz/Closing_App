import { describe, expect, it } from "vitest";

import { createForwardToken, forwardIdOf, verifyForwardToken } from "./token";

const secret = "a-test-secret-that-is-long-enough-123";

describe("forward tokens", () => {
  it("round-trips for the recipient's address, whatever its case", () => {
    const token = createForwardToken("cm1fwd", "marie@acme.fr", secret);
    expect(forwardIdOf(token)).toBe("cm1fwd");
    expect(verifyForwardToken(token, "Marie@Acme.fr", secret)).toBe(true);
  });

  it("rejects another address, another forward or another secret", () => {
    const token = createForwardToken("cm1fwd", "marie@acme.fr", secret);
    expect(verifyForwardToken(token, "paul@acme.fr", secret)).toBe(false);
    const [, signature] = token.split(".");
    expect(verifyForwardToken(`cm1xyz.${signature}`, "marie@acme.fr", secret)).toBe(false);
    expect(verifyForwardToken(token, "marie@acme.fr", "another-secret-that-is-long-enough-456")).toBe(false);
  });

  it("rejects malformed tokens", () => {
    for (const token of ["", "cm1fwd", ".abc", "cm1fwd.", "cm1fwd.short", "bad id.abc"]) {
      expect(verifyForwardToken(token, "marie@acme.fr", secret)).toBe(false);
    }
    expect(forwardIdOf("bad id.abc")).toBeNull();
  });
});
