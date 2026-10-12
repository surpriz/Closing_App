import { describe, expect, it } from "vitest";

import { firstParam, parsePage } from "./format";

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
