import { describe, expect, it } from "vitest";

import {
  formatUserCode,
  generatePollSecret,
  generateUserCode,
  hashPollSecret,
  normalizeUserCode,
  outlookConnectedEmail,
} from "./extension-pairing";

describe("extension pairing", () => {
  it("generates readable eight-character codes", () => {
    const code = generateUserCode();
    expect(code).toMatch(/^[BCDFGHJKMNPQRSTVWXZ2-9]{8}$/);
    expect(normalizeUserCode(code)).toBe(code);
  });

  it("formats and reads back what the seller typed", () => {
    expect(formatUserCode("BCDFGHJK")).toBe("BCDF-GHJK");
    expect(normalizeUserCode(" bcdf-ghjk ")).toBe("BCDFGHJK");
    expect(normalizeUserCode("BCDF GHJK")).toBe("BCDFGHJK");
  });

  it("rejects what can't be a code", () => {
    expect(normalizeUserCode("BCDF-GHJ")).toBeNull();
    expect(normalizeUserCode("BCDF-GHJO")).toBeNull();
    expect(normalizeUserCode("")).toBeNull();
  });

  it("hashes the poll secret", () => {
    const secret = generatePollSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashPollSecret(secret)).toBe(hashPollSecret(secret));
    expect(hashPollSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("outlookConnectedEmail", () => {
  it("says when, and where to revoke", () => {
    const email = outlookConnectedEmail({
      at: new Date("2026-10-09T13:05:00Z"),
      settingsUrl: "https://app.clozer.club/settings#extension",
    });
    expect(email.text).toContain("9 octobre 2026");
    expect(email.text).toContain("15:05");
    expect(email.text).toContain("https://app.clozer.club/settings#extension");
    expect(email.html).toContain('href="https://app.clozer.club/settings#extension"');
  });
});
