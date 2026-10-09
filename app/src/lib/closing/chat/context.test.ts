import { describe, expect, it } from "vitest";

import { buildChatContext, hasChatKnowledge, type ChatKnowledge } from "./context";

const base: ChatKnowledge = {
  document: { title: "Devis cuisine", kind: "FILE", docType: "QUOTE", docPurpose: null, sellerDescription: null, assistantNotes: null },
  pages: [
    { pageNumber: 1, text: "Présentation de l'entreprise. ".repeat(40), summary: "Qui nous sommes", keyFacts: [], tags: ["TEAM"] },
    { pageNumber: 2, text: "Total 12 000 € HT. Acompte 30 %.", summary: "Les prix", keyFacts: ["Total 12 000 € HT"], tags: ["PRICING"] },
    { pageNumber: 3, text: "Paiement à 30 jours.", summary: "Conditions", keyFacts: [], tags: ["TERMS"] },
  ],
  workspace: { offerDescription: "Cuisines sur mesure", valueProps: null, assistantKnowledge: null },
};

describe("buildChatContext", () => {
  it("keeps pricing and terms pages first when the budget is tight", () => {
    const { text } = buildChatContext(base, 1000);
    expect(text).toContain('<page number="2">');
    expect(text).toContain('<page number="3">');
    expect(text).not.toContain('<page number="1">');
    expect(text).toContain("did not fit");
  });

  it("lists every page in the index, even when its text is left out", () => {
    const { text } = buildChatContext(base, 1000);
    expect(text).toMatch(/Page 1 \[Équipe\] — Qui nous sommes/);
    expect(text).toMatch(/Page 2 \[Tarifs\]/);
  });

  it("puts pages back in reading order", () => {
    const { text } = buildChatContext(base);
    expect(text.indexOf('<page number="1">')).toBeLessThan(text.indexOf('<page number="2">'));
  });

  it("gives the guard every quotable text, key facts included", () => {
    const { sourceText } = buildChatContext({ ...base, pages: [{ ...base.pages[1], text: null }] });
    expect(sourceText).toContain("Total 12 000 € HT");
    expect(sourceText).toContain("Cuisines sur mesure");
  });

  it("uses the seller description of a URL document", () => {
    const url: ChatKnowledge = {
      ...base,
      document: { ...base.document, kind: "URL", sellerDescription: "Notre offre SaaS, 49 €/mois" },
      pages: [],
    };
    expect(hasChatKnowledge(url)).toBe(true);
    expect(buildChatContext(url).text).toContain("Notre offre SaaS");
  });

  it("always keeps what the seller wrote for the assistant, even when the budget is tight", () => {
    const { text, sourceText } = buildChatContext(
      {
        ...base,
        document: { ...base.document, assistantNotes: "Hors périmètre : le site WordPress." },
        workspace: { ...base.workspace, assistantKnowledge: "Paiement à 30 jours, SAV par email." },
      },
      600,
    );
    expect(text).toContain("<seller_notes_on_this_document>\nHors périmètre : le site WordPress.");
    expect(text).toContain("<seller_knowledge>\nPaiement à 30 jours, SAV par email.");
    expect(sourceText).toContain("Paiement à 30 jours");
  });

  it("can answer from the seller's notes alone", () => {
    expect(hasChatKnowledge({ ...base, pages: [], document: { ...base.document, assistantNotes: "Audit de 8 repos." } })).toBe(true);
  });

  it("has nothing to answer from without text, summary or description", () => {
    expect(hasChatKnowledge({ ...base, pages: [{ ...base.pages[0], text: " ", summary: null }] })).toBe(false);
  });
});
