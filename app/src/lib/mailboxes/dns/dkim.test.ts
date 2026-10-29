import { describe, expect, it } from "vitest";

import { dkimSelectorsFor, parseDkim } from "./dkim";

describe("dkim", () => {
  it("detects a key by v=DKIM1 or p=", () => {
    expect(parseDkim(["v=DKIM1; k=rsa; p=MIGf"])).toEqual({ present: true, revoked: false });
    expect(parseDkim(["k=rsa; p=MIGf"])).toEqual({ present: true, revoked: false });
  });
  it("treats an empty p= as revoked", () => {
    expect(parseDkim(["v=DKIM1; p="])).toEqual({ present: true, revoked: true });
  });
  it("reports absence", () => {
    expect(parseDkim([])).toEqual({ present: false, revoked: false });
  });
  it("picks selectors per provider", () => {
    expect(dkimSelectorsFor("GOOGLE", null)).toEqual(["google"]);
    expect(dkimSelectorsFor("MICROSOFT", null)).toEqual(["selector1", "selector2"]);
    expect(dkimSelectorsFor("IMAP", "ovh")).toContain("k1");
    expect(dkimSelectorsFor("IMAP", null).length).toBeGreaterThan(0);
  });
});
