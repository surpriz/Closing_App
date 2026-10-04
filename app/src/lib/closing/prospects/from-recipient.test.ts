import { describe, expect, it } from "vitest";

import { companyFromEmail, parseRecipient, prospectFromRecipient } from "./from-recipient";

describe("parseRecipient", () => {
  it("reads a display name and an address", () => {
    expect(parseRecipient("Marie Dupont <Marie@Acme.fr>")).toEqual({
      email: "marie@acme.fr",
      displayName: "Marie Dupont",
    });
  });

  it("strips quotes around names with commas", () => {
    expect(parseRecipient('"Dupont, Marie" <marie@acme.fr>')?.displayName).toBe("Dupont, Marie");
  });

  it("accepts a bare address", () => {
    expect(parseRecipient(" marie@acme.fr ")).toEqual({ email: "marie@acme.fr", displayName: null });
  });

  it("rejects garbage", () => {
    expect(parseRecipient("Marie Dupont")).toBeNull();
    expect(parseRecipient("<not an email>")).toBeNull();
  });
});

describe("companyFromEmail", () => {
  it("titles the domain label", () => {
    expect(companyFromEmail("marie@acme-group.fr")).toBe("Acme Group");
  });

  it("ignores subdomains", () => {
    expect(companyFromEmail("marie@mail.acme.com")).toBe("Acme");
  });

  it("handles two-part public suffixes", () => {
    expect(companyFromEmail("john@acme.co.uk")).toBe("Acme");
    expect(companyFromEmail("ana@acme.com.br")).toBe("Acme");
  });

  it("returns null for personal mailboxes", () => {
    expect(companyFromEmail("marie@gmail.com")).toBeNull();
    expect(companyFromEmail("marie@outlook.fr")).toBeNull();
    expect(companyFromEmail("marie@orange.fr")).toBeNull();
  });
});

describe("prospectFromRecipient", () => {
  it("builds the prospect", () => {
    expect(prospectFromRecipient({ email: "Marie@Acme.fr", displayName: "Marie Dupont" })).toEqual({
      email: "marie@acme.fr",
      name: "Marie Dupont",
      company: "Acme",
    });
  });

  it("drops a display name that is only the address", () => {
    expect(prospectFromRecipient({ email: "marie@acme.fr", displayName: "marie@acme.fr" })?.name).toBeNull();
  });

  it("rejects an invalid address", () => {
    expect(prospectFromRecipient({ email: "nope" })).toBeNull();
  });
});
