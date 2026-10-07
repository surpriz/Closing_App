import { describe, expect, it } from "vitest";

import { cleanDisplayTitle, humanizeName, linkTitle } from "./link-title";

describe("humanizeName", () => {
  it("turns a file name into words", () => {
    expect(humanizeName("devis-exemple")).toBe("Devis exemple");
    expect(humanizeName("proposition__acme--v2.pdf")).toBe("Proposition acme v2");
    expect(humanizeName("2026-08-AD (1)")).toBe("2026 08 AD");
  });
});

describe("cleanDisplayTitle", () => {
  it("strips quotes and trailing punctuation", () => {
    expect(cleanDisplayTitle(' « Entretien mensuel – Thomas ». ')).toBe("Entretien mensuel – Thomas");
  });

  it("rejects empty titles and shortens long ones", () => {
    expect(cleanDisplayTitle("  ")).toBeNull();
    expect(cleanDisplayTitle("a".repeat(100))).toHaveLength(70);
  });
});

describe("linkTitle", () => {
  it("prefers the AI title", () => {
    expect(linkTitle({ name: "2026-08-AD (1)", displayTitle: "Entretien mensuel – Thomas", docType: "OTHER" })).toBe(
      "Entretien mensuel – Thomas",
    );
    expect(linkTitle({ name: "x", displayTitle: "Devis rénovation cuisine", docType: "QUOTE", company: "Acme" })).toBe(
      "Devis rénovation cuisine – Acme",
    );
  });

  it("uses the document type and the company", () => {
    expect(linkTitle({ name: "devis-exemple", docType: "QUOTE", company: "Acme Group" })).toBe("Devis – Acme Group");
  });

  it("falls back to the file name before the AI has read the document", () => {
    expect(linkTitle({ name: "devis-exemple", docType: null, company: "Acme" })).toBe("Devis exemple – Acme");
    expect(linkTitle({ name: "devis-exemple", docType: "OTHER" })).toBe("Devis exemple");
  });

  it("does not repeat a company already in the name", () => {
    expect(linkTitle({ name: "Proposition Acme 2026", company: "Acme" })).toBe("Proposition Acme 2026");
  });

  it("never returns an empty title", () => {
    expect(linkTitle({ name: "---" })).toBe("Document");
  });
});
