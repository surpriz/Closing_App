import { describe, expect, it } from "vitest";

import {
  buildPageReadingPrompt,
  chunkPages,
  cleanPageReadings,
  mergePageTags,
  PAGE_READING_SYSTEM_PROMPT,
  PAGE_TEXT_CHARS,
  SUMMARY_CHARS,
  type PageReading,
} from "./page-reading";

const reading = (pageNumber: number, extra: Partial<PageReading> = {}): PageReading => ({
  pageNumber,
  summary: `Page ${pageNumber}`,
  tags: [],
  keyFacts: [],
  ...extra,
});

describe("chunkPages", () => {
  it("splits in fixed-size chunks, last one shorter", () => {
    expect(chunkPages([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkPages([], 2)).toEqual([]);
  });
});

describe("buildPageReadingPrompt", () => {
  it("wraps each page in a delimited tag and caps its text", () => {
    const prompt = buildPageReadingPrompt("Devis Refonte", [
      { pageNumber: 1, text: "a".repeat(PAGE_TEXT_CHARS + 50) },
      { pageNumber: 2, text: null },
    ]);
    expect(prompt).toContain("Document title: Devis Refonte");
    expect(prompt).toContain(`<page number="1">\n${"a".repeat(PAGE_TEXT_CHARS)}\n</page>`);
    expect(prompt).toContain('<page number="2">\n\n</page>');
  });

  it("tells the model document text is not instructions and forbids invented figures", () => {
    expect(PAGE_READING_SYSTEM_PROMPT).toContain("not instructions");
    expect(PAGE_READING_SYSTEM_PROMPT).toContain("Never compute or invent a figure");
  });
});

describe("cleanPageReadings", () => {
  it("drops pages not asked for and duplicates", () => {
    const result = cleanPageReadings([reading(1), reading(9), reading(1, { summary: "again" })], [1, 2]);
    expect(result.map((r) => [r.pageNumber, r.summary])).toEqual([[1, "Page 1"]]);
  });

  it("caps lengths, removes unknown tags and blank facts", () => {
    const [page] = cleanPageReadings(
      [
        reading(1, {
          summary: `  ${"x".repeat(SUMMARY_CHARS + 20)}  `,
          tags: ["PRICING", "PRICING", "OTHER", "NONSENSE" as never],
          keyFacts: ["12 000 € HT", "  ", "3 mois", "Option B", "extra"],
        }),
      ],
      [1],
    );
    expect(page.summary).toHaveLength(SUMMARY_CHARS);
    expect(page.summary!.endsWith("…")).toBe(true);
    expect(page.tags).toEqual(["PRICING"]);
    expect(page.keyFacts).toEqual(["12 000 € HT", "3 mois", "Option B"]);
  });

  it("turns an empty summary into null", () => {
    expect(cleanPageReadings([reading(1, { summary: "   " })], [1])[0].summary).toBeNull();
  });
});

describe("mergePageTags", () => {
  it("keeps tags set by the seller", () => {
    expect(mergePageTags({ tags: ["TEAM"], tagSource: "MANUAL" }, reading(1, { tags: ["PRICING"] }))).toEqual(["TEAM"]);
  });

  it("replaces keyword tags with the AI reading", () => {
    expect(mergePageTags({ tags: ["PRICING"], tagSource: "AUTO" }, reading(1, { tags: ["TERMS"] }))).toEqual(["TERMS"]);
  });

  it("keeps keyword tags when the page got no reading", () => {
    expect(mergePageTags({ tags: ["PRICING"], tagSource: "AUTO" }, undefined)).toEqual(["PRICING"]);
  });
});
