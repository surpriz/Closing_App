import { describe, expect, it } from "vitest";

import { parseSpf, spfStatus } from "./spf";

describe("spf", () => {
  it("parses includes and the all qualifier", () => {
    const spf = parseSpf(["google-site-verification=x", "v=spf1 include:_spf.google.com include:mailgun.org ~all"]);
    expect(spf).toMatchObject({ present: true, includes: ["_spf.google.com", "mailgun.org"], all: "~all", duplicates: false });
    expect(spfStatus(spf, "_spf.google.com")).toBe("ok");
  });
  it("follows a redirect like an include (gmail.com)", () => {
    const spf = parseSpf(["v=spf1 redirect=_spf.google.com"]);
    expect(spf.includes).toEqual(["_spf.google.com"]);
    expect(spfStatus(spf, "_spf.google.com")).toBe("ok");
  });
  it("reports a missing provider include", () => {
    expect(spfStatus(parseSpf(["v=spf1 -all"]), "mx.ovh.com")).toBe("missing_provider");
  });
  it("reports a missing record", () => {
    const spf = parseSpf(["hello"]);
    expect(spf).toMatchObject({ present: false, record: null, all: null });
    expect(spfStatus(spf, "mx.ovh.com")).toBe("missing");
  });
  it("flags duplicates", () => {
    expect(spfStatus(parseSpf(["v=spf1 -all", "v=spf1 ~all"]), null)).toBe("duplicate");
  });
  it("accepts any record when no include is expected", () => {
    expect(spfStatus(parseSpf(["v=spf1 a mx -all"]), null)).toBe("unknown_provider");
  });
});
