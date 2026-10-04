import { describe, expect, it } from "vitest";

import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/extension/connect?nonce=abc")).toBe("/extension/connect?nonce=abc");
  });

  it("rejects other sites", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("/\t/evil.example")).toBeNull();
    expect(safeNextPath("/\n/evil.example")).toBeNull();
    expect(safeNextPath("/\r/evil.example")).toBeNull();
  });
});
