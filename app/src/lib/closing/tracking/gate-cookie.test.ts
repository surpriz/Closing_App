import { describe, expect, it } from "vitest";

import { LEGACY_GATE_COOKIES_UNTIL, readGateCookie, signGateCookie } from "./gate-cookie";

const SECRET = "a".repeat(32);
const AFTER = new Date(LEGACY_GATE_COOKIES_UNTIL.getTime() + 1000);
const BEFORE = new Date(LEGACY_GATE_COOKIES_UNTIL.getTime() - 1000);

describe("gate cookie", () => {
  it("reads back the email it was signed with", () => {
    const value = signGateCookie("link1", "marie.dupont@acme.fr", SECRET);
    expect(readGateCookie("link1", value, SECRET)).toEqual({ email: "marie.dupont@acme.fr", signed: true });
  });

  it("reads a plain email during the transition, flagged unsigned for the prospect check", () => {
    expect(readGateCookie("link1", "marie@acme.fr", SECRET, BEFORE)).toEqual({ email: "marie@acme.fr", signed: false });
  });

  it("rejects a plain email once the transition is over", () => {
    expect(readGateCookie("link1", "marie@acme.fr", SECRET, AFTER)).toBeNull();
  });

  it("rejects another email with the same signature", () => {
    const signature = signGateCookie("link1", "marie@acme.fr", SECRET).split(".").pop();
    expect(readGateCookie("link1", `paul@acme.fr.${signature}`, SECRET, AFTER)).toBeNull();
  });

  it("rejects a cookie copied from another link", () => {
    const value = signGateCookie("link1", "marie@acme.fr", SECRET);
    expect(readGateCookie("link2", value, SECRET, AFTER)).toBeNull();
  });

  it("rejects an empty value", () => {
    expect(readGateCookie("link1", undefined, SECRET)).toBeNull();
    expect(readGateCookie("link1", "", SECRET)).toBeNull();
  });
});
