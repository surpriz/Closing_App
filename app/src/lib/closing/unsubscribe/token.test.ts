import { describe, expect, it } from "vitest";

import {
  createUnsubscribeToken,
  encodeUnsubscribeSubject,
  parseUnsubscribeSubject,
  verifyUnsubscribeToken,
} from "./token";

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

  it("round-trips a prospect and an enrollment subject through a token", () => {
    for (const kind of ["prospect", "enrollment"] as const) {
      const token = createUnsubscribeToken(encodeUnsubscribeSubject({ kind, id: "cm1abc" }), secret);
      const subject = verifyUnsubscribeToken(token, secret);
      expect(subject).not.toBeNull();
      expect(parseUnsubscribeSubject(subject!)).toEqual({ kind, id: "cm1abc" });
    }
  });

  it("encodes with a one-letter prefix", () => {
    expect(encodeUnsubscribeSubject({ kind: "prospect", id: "x" })).toBe("p:x");
    expect(encodeUnsubscribeSubject({ kind: "enrollment", id: "x" })).toBe("e:x");
  });

  it("accepts a legacy bare id as a prospect", () => {
    const token = createUnsubscribeToken("cm1abc", secret);
    expect(parseUnsubscribeSubject(verifyUnsubscribeToken(token, secret)!)).toEqual({ kind: "prospect", id: "cm1abc" });
  });

  it("refuses an unknown prefix or an empty id", () => {
    expect(parseUnsubscribeSubject("x:cm1abc")).toBeNull();
    expect(parseUnsubscribeSubject("p:")).toBeNull();
    expect(parseUnsubscribeSubject("")).toBeNull();
  });

  it("rejects a prefix swapped without re-signing", () => {
    const [, signature] = createUnsubscribeToken("p:cm1abc", secret).split(".");
    expect(verifyUnsubscribeToken(`e:cm1abc.${signature}`, secret)).toBeNull();
  });
});
