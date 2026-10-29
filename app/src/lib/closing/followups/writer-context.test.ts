import { describe, expect, it } from "vitest";

import { guardSourceText, pickRelevantSections, previousMessagesOf } from "./writer-context";

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

  it("follows what a cold email reader read the longest, else the trigger's sections", () => {
    expect(
      pickRelevantSections(pages, null, "WARM_READ", null, ["CASE_STUDY", "OTHER", "SCOPE"]).map((s) => s.section),
    ).toEqual(["Références", "Périmètre"]);
    expect(pickRelevantSections(pages, null, "WARM_READ", null, []).map((s) => s.section)).toEqual([
      "Références",
      "Périmètre",
    ]);
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

describe("previousMessagesOf", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("merges the link's follow-ups and the campaign's steps, newest first, three at most", () => {
    const result = previousMessagesOf(
      [{ sentAt: ago(2), channel: "EMAIL", subject: "Suite", body: "Relance IA" }],
      [
        { sentAt: ago(9), subject: "Devis", body: "x".repeat(400) },
        { sentAt: ago(6), subject: null, body: "Étape 2" },
        { sentAt: ago(12), subject: "Plus vieux", body: "Jamais" },
      ],
      now,
    );
    expect(result).toEqual([
      { daysAgo: 2, channel: "EMAIL", subject: "Suite", excerpt: "Relance IA" },
      { daysAgo: 6, channel: "EMAIL", subject: null, excerpt: "Étape 2" },
      { daysAgo: 9, channel: "EMAIL", subject: "Devis", excerpt: "x".repeat(300) },
    ]);
  });

  it("is the link's follow-ups alone outside a campaign", () => {
    expect(previousMessagesOf([{ sentAt: ago(1), channel: "WHATSAPP", subject: null, body: null }], [], now)).toEqual([
      { daysAgo: 1, channel: "WHATSAPP", subject: null, excerpt: "" },
    ]);
  });
});
