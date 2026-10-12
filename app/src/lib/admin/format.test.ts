import { describe, expect, it } from "vitest";

import { auditDetail, firstParam, parsePage } from "./format";

describe("parsePage", () => {
  it("reads a positive integer", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "5"])).toBe(2);
  });

  it("falls back to the first page", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });
});

describe("firstParam", () => {
  it("trims and drops empty values", () => {
    expect(firstParam(" acme ")).toBe("acme");
    expect(firstParam("  ")).toBeUndefined();
    expect(firstParam(["a", "b"])).toBe("a");
  });
});

describe("auditDetail", () => {
  it("names the email, the mode or the duration", () => {
    expect(auditDetail({ email: "a@b.fr" })).toBe("a@b.fr");
    expect(auditDetail({ mode: "invite_only" })).toBe("sur invitation");
    expect(auditDetail({ days: 7 })).toBe("7 jours");
    expect(auditDetail({ days: 1 })).toBe("1 jour");
    expect(auditDetail({ days: null })).toBe("jusqu'à réactivation");
  });

  it("is null when there is nothing to say", () => {
    expect(auditDetail(null)).toBeNull();
    expect(auditDetail({})).toBeNull();
    expect(auditDetail("x")).toBeNull();
  });
});
