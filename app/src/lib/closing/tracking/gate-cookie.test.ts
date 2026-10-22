import { describe, expect, it } from "vitest";

import { readGateCookie, signGateCookie } from "./gate-cookie";

const SECRET = "a".repeat(32);

describe("gate cookie", () => {
  it("reads back the email it was signed with", () => {
    const value = signGateCookie("link1", "marie.dupont@acme.fr", SECRET);
    expect(readGateCookie("link1", value, SECRET)).toBe("marie.dupont@acme.fr");
  });

  it("rejects a plain email, as written before signing", () => {
    expect(readGateCookie("link1", "marie@acme.fr", SECRET)).toBeNull();
  });

  it("rejects another email with the same signature", () => {
    const signature = signGateCookie("link1", "marie@acme.fr", SECRET).split(".").pop();
    expect(readGateCookie("link1", `paul@acme.fr.${signature}`, SECRET)).toBeNull();
  });

  it("rejects a cookie copied from another link", () => {
    const value = signGateCookie("link1", "marie@acme.fr", SECRET);
    expect(readGateCookie("link2", value, SECRET)).toBeNull();
  });

  it("rejects an empty value", () => {
    expect(readGateCookie("link1", undefined, SECRET)).toBeNull();
    expect(readGateCookie("link1", "", SECRET)).toBeNull();
  });
});
