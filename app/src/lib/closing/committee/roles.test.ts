import { describe, expect, it } from "vitest";

import { classifyRole, effectiveRole, isDecisionRole } from "./roles";

const role = (email: string | null, name: string | null = null) => classifyRole({ email, name });

describe("classifyRole", () => {
  it("spots finance from the email", () => {
    expect(role("cfo@acme.fr")).toBe("FINANCE");
    expect(role("pierre.daf@acme.fr")).toBe("FINANCE");
    expect(role("achats@acme.fr")).toBe("FINANCE");
  });

  it("spots executives from the email or the name", () => {
    expect(role("ceo@acme.fr")).toBe("DECISION_MAKER");
    expect(role("marie@acme.fr", "Marie Dupont - Directrice Générale")).toBe("DECISION_MAKER");
    expect(role("j.martin@acme.com", "John Martin, Managing Director")).toBe("DECISION_MAKER");
  });

  it("prefers finance when both match", () => {
    expect(role("vp.finance@acme.com")).toBe("FINANCE");
  });

  it("matches whole words only", () => {
    expect(role("dgarcia@acme.fr")).toBeNull();
    expect(role("vincent@acme.fr")).toBeNull();
  });

  it("ignores shared mailboxes and unknown people", () => {
    expect(role("contact@acme.fr")).toBeNull();
    expect(role("anne.martin@acme.fr", "Anne Martin")).toBeNull();
    expect(role(null, null)).toBeNull();
  });
});

describe("effectiveRole", () => {
  it("lets the seller tag win, including OTHER to silence a guess", () => {
    expect(effectiveRole({ role: "CHAMPION", email: "cfo@acme.fr", name: null })).toEqual({ role: "CHAMPION", source: "seller" });
    expect(effectiveRole({ role: "OTHER", email: "cfo@acme.fr", name: null })).toEqual({ role: "OTHER", source: "seller" });
  });

  it("falls back to the guess", () => {
    expect(effectiveRole({ role: null, email: "cfo@acme.fr", name: null })).toEqual({ role: "FINANCE", source: "detected" });
    expect(effectiveRole({ role: null, email: "anne@acme.fr", name: null })).toBeNull();
  });
});

describe("isDecisionRole", () => {
  it("covers executives and finance only", () => {
    expect(isDecisionRole("DECISION_MAKER")).toBe(true);
    expect(isDecisionRole("FINANCE")).toBe(true);
    expect(isDecisionRole("CHAMPION")).toBe(false);
    expect(isDecisionRole(null)).toBe(false);
  });
});
