import { describe, expect, it } from "vitest";

import { createUnsubscribeToken, verifyUnsubscribeToken } from "./token";

const secret = "a-test-secret-that-is-long-enough-123";

describe("unsubscribe tokens", () => {
  it("round-trips the prospect id", () => {
    const token = createUnsubscribeToken("cm1abc", secret);
    expect(verifyUnsubscribeToken(token, secret)).toBe("cm1abc");
  });

  it("rejects a token signed for another prospect", () => {
    const [, signature] = createUnsubscribeToken("cm1abc", secret).split(".");
    expect(verifyUnsubscribeToken(`cm1xyz.${signature}`, secret)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createUnsubscribeToken("cm1abc", "another-secret-that-is-long-enough-456");
    expect(verifyUnsubscribeToken(token, secret)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyUnsubscribeToken("", secret)).toBeNull();
    expect(verifyUnsubscribeToken("cm1abc", secret)).toBeNull();
    expect(verifyUnsubscribeToken(".abc", secret)).toBeNull();
    expect(verifyUnsubscribeToken("cm1abc.short", secret)).toBeNull();
  });
});
