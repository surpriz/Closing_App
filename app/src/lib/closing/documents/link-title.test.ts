import { describe, expect, it } from "vitest";

import { humanizeName, linkTitle } from "./link-title";

describe("humanizeName", () => {
  it("turns a file name into words", () => {
    expect(humanizeName("devis-exemple")).toBe("Devis exemple");
    expect(humanizeName("proposition__acme--v2.pdf")).toBe("Proposition acme v2");
  });
});

describe("linkTitle", () => {
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
