import { describe, expect, it } from "vitest";

import { guardSourceText, pickRelevantSections } from "./writer-context";

const pages = [
  { tags: ["SCOPE" as const], summary: "Refonte complète du site", keyFacts: ["8 semaines"], text: "Périmètre" },
  { tags: ["PRICING" as const], summary: "Prix et options", keyFacts: ["12 000 € HT"], text: "Total 12 000 €" },
  { tags: ["TERMS" as const], summary: null, keyFacts: [], text: "CGV" },
  { tags: ["CASE_STUDY" as const], summary: "Cas client Acme", keyFacts: ["+18 % de conversion"], text: "Réf" },
];

describe("pickRelevantSections", () => {
  it("picks sections by goal, named, without page numbers", () => {
    expect(pickRelevantSections(pages, "clarify_pricing", "AI_DECISION")).toEqual([
      { section: "Tarifs", summary: "Prix et options", keyFacts: ["12 000 € HT"] },
    ]);
    expect(JSON.stringify(pickRelevantSections(pages, "address_objection", "AI_DECISION"))).not.toMatch(/page|p\.\d/i);
  });

  it("falls back on the trigger when there is no brief", () => {
    expect(pickRelevantSections(pages, null, "HOT_PRICING").map((s) => s.section)).toEqual(["Tarifs"]);
    expect(pickRelevantSections(pages, null, "ANTI_GHOSTING").map((s) => s.section)).toEqual(["Périmètre"]);
  });
});

describe("guardSourceText", () => {
  it("gathers every place a figure may come from", () => {
    const text = guardSourceText({
      pages,
      sellerDescription: null,
      senderSignature: "Jérôme, 06 12 34 56 78",
      offerDescription: "Sites Shopify",
      valueProps: null,
    });
    expect(text).toContain("12 000 € HT");
    expect(text).toContain("+18 % de conversion");
    expect(text).toContain("06 12 34 56 78");
  });
});
