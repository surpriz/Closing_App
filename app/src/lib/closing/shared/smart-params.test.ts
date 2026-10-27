import { describe, expect, it } from "vitest";

import { parseSmartParams, smartLinkProblem, smartLinkUrl } from "./smart-params";

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

describe("smartLinkProblem", () => {
  it("flags an address sent to a personal link, which ignores it", () => {
    expect(smartLinkProblem({ email: "paul@acme.fr" }, false)).toEqual({ kind: "personal_link", tag: null });
    expect(smartLinkProblem({ email: "{{EMAIL}}" }, false)).toEqual({ kind: "personal_link", tag: null });
  });

  it("flags a Smart Link whose tool left the variable as is", () => {
    expect(smartLinkProblem({ email: "{{EMAIL}}" }, true)).toEqual({ kind: "unresolved_tag", tag: "{{EMAIL}}" });
    expect(smartLinkProblem({ email: "%EMAIL%" }, true)?.kind).toBe("unresolved_tag");
  });

  it("says nothing when the Smart Link works or nothing came from a sequence", () => {
    expect(smartLinkProblem({ email: "paul@acme.fr" }, true)).toBeNull();
    expect(smartLinkProblem({}, false)).toBeNull();
    expect(smartLinkProblem({ email: "1" }, false)).toBeNull();
    expect(smartLinkProblem({ email: "pas un email" }, false)).toBeNull();
  });
});
