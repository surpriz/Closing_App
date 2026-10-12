import { describe, expect, it } from "vitest";

import { parseSmartParams, smartLinkUrl } from "./smart-params";

describe("parseSmartParams", () => {
  it("reads the email, company and name the tool filled in", () => {
    expect(parseSmartParams({ email: " Jean@Acme.fr ", company: "Acme", name: "Jean" })).toEqual({
      email: "jean@acme.fr",
      company: "Acme",
      name: "Jean",
    });
  });

  it("puts back a + the query string turned into a space", () => {
    expect(parseSmartParams({ email: "jean test@acme.fr" })?.email).toBe("jean+test@acme.fr");
  });

  it("accepts the tools' own parameter names", () => {
    expect(parseSmartParams({ email: "jean@acme.fr", companyName: "Acme", firstName: "Jean" })).toMatchObject({
      company: "Acme",
      name: "Jean",
    });
  });

  it("ignores merge tags left unresolved", () => {
    expect(parseSmartParams({ email: "{{email}}" })).toBeNull();
    expect(parseSmartParams({ email: "jean@acme.fr", company: "{{companyName}}" })?.company).toBeNull();
  });

  it("ignores what is not an email, like the plain gate flag", () => {
    expect(parseSmartParams({ email: "1" })).toBeNull();
    expect(parseSmartParams({ email: "" })).toBeNull();
    expect(parseSmartParams({})).toBeNull();
  });

  it("keeps the first value of a repeated parameter and caps long text", () => {
    const parsed = parseSmartParams({ email: ["jean@acme.fr", "paul@acme.fr"], company: "x".repeat(300) });
    expect(parsed?.email).toBe("jean@acme.fr");
    expect(parsed?.company).toHaveLength(120);
  });
});

describe("smartLinkUrl", () => {
  it("writes the tool's variables", () => {
    expect(smartLinkUrl("https://clozer.club/v/abc", "lemlist")).toBe(
      "https://clozer.club/v/abc?email={{email}}&company={{companyName}}&name={{firstName}}",
    );
  });
});
