import { describe, expect, it } from "vitest";

import { customLinkName, dealDocumentMeta, dealLabel, type LabelledLink } from "./labels";

const document = { name: "Devis 2026.pdf", displayTitle: "Devis 2026", docType: "QUOTE" };
const link = (over: Partial<LabelledLink> = {}): LabelledLink => ({
  name: null,
  slug: "ab12cd34ef56",
  document,
  prospects: [],
  ...over,
});
const prospect = (over: Partial<LabelledLink["prospects"][number]> = {}) => ({
  company: null,
  name: null,
  email: null,
  ...over,
});

describe("dealLabel", () => {
  it("names the deal after the company and the person, so two contacts at Acme read apart", () => {
    expect(dealLabel(link({ name: "Devis 2026", prospects: [prospect({ company: "Acme", name: "Léa", email: "lea@acme.fr" })] }))).toBe("Acme · Léa");
  });

  it("names the company alone when the contact has only an email", () => {
    expect(dealLabel(link({ prospects: [prospect({ company: "Acme", email: "lea@acme.fr" })] }))).toBe("Acme");
  });

  it("falls back to the contact name, then the email", () => {
    expect(dealLabel(link({ prospects: [prospect({ name: "Léa Martin", email: "lea@acme.fr" })] }))).toBe("Léa Martin");
    expect(dealLabel(link({ prospects: [prospect({ email: "lea@acme.fr" })] }))).toBe("lea@acme.fr");
  });

  it("puts the contact before a link name the seller typed", () => {
    expect(dealLabel(link({ name: "Relance printemps", prospects: [prospect({ email: "lea@acme.fr" })] }))).toBe("lea@acme.fr");
  });

  it("uses a link name the seller typed when there is no contact", () => {
    expect(dealLabel(link({ name: "Relance printemps" }))).toBe("Relance printemps");
  });

  it("never names a deal after its document", () => {
    expect(dealLabel(link({ name: "Devis 2026.pdf" }))).toBe("Sans destinataire");
    expect(dealLabel(link({ name: "Devis 2026" }))).toBe("Sans destinataire");
    expect(dealLabel(link({ name: "Devis 2026 – Acme" }))).toBe("Sans destinataire");
    expect(dealLabel(link({ name: "Pitch vidéo du 12 octobre", document: { name: "Pitch vidéo du 12 octobre" } }))).toBe("Sans destinataire");
  });

  it("works without a document in the select", () => {
    expect(dealLabel(link({ name: "Relance printemps", document: undefined }))).toBe("Relance printemps");
    expect(dealLabel(link({ document: undefined }))).toBe("Sans destinataire");
  });
});

describe("customLinkName", () => {
  it("keeps a real name and drops the document title", () => {
    expect(customLinkName(link({ name: "  Relance printemps " }))).toBe("Relance printemps");
    expect(customLinkName(link({ name: "Devis 2026" }))).toBeNull();
    expect(customLinkName(link({ name: "   " }))).toBeNull();
    expect(customLinkName(link({ name: null }))).toBeNull();
  });
});

describe("dealDocumentMeta", () => {
  it("gives the document unless it is already the label", () => {
    expect(dealDocumentMeta(link({ prospects: [prospect({ company: "Acme" })] }))).toBe("Devis 2026");
    expect(dealDocumentMeta(link({ prospects: [prospect({ company: "Devis 2026" })] }))).toBeNull();
    expect(dealDocumentMeta(link({ document: undefined }))).toBeNull();
  });

  it("shows the document by its title, not its file name", () => {
    expect(dealDocumentMeta(link({ prospects: [prospect({ company: "Acme" })], document: { name: "modele_de_devis_batiment.pdf", displayTitle: "Devis n°624 – Prestation de service" } }))).toBe("Devis n°624 – Prestation de service");
    expect(dealDocumentMeta(link({ document: { name: "modele_de_devis_batiment.pdf", displayTitle: null } }))).toBe("modele_de_devis_batiment.pdf");
  });
});
