import { describe, expect, it } from "vitest";

import { FAQ, faqAsText, getFaq, getFaqText } from "./faq";
import { FAQ_EN } from "./faq.en";
import { HELP_GUIDE, getGuide } from "./guide";
import { HELP_GUIDE_EN } from "./guide.en";

const shape = (sections: typeof FAQ) =>
  sections.map((section) => ({
    id: section.id,
    items: section.items.map((item) => ({ id: item.id, href: item.link?.href ?? null })),
  }));

const headings = (guide: string) => guide.split("\n").filter((line) => line.startsWith("## "));

describe("FAQ in both languages", () => {
  it("keeps the same sections, questions, order and link targets", () => {
    expect(shape(FAQ_EN)).toEqual(shape(FAQ));
    expect(FAQ_EN.flatMap((s) => s.items)).toHaveLength(FAQ.flatMap((s) => s.items).length);
  });

  it("picks the FAQ by locale", () => {
    expect(getFaq("fr")).toBe(FAQ);
    expect(getFaq("en")).toBe(FAQ_EN);
  });

  it("labels the answers in the assistant's text by language", () => {
    expect(getFaqText("fr")).toBe(faqAsText(FAQ));
    expect(getFaqText("en")).toContain("\nA: ");
    expect(getFaqText("en")).not.toContain("\nR: ");
  });
});

describe("guide in both languages", () => {
  it("has the same number of sections", () => {
    expect(headings(HELP_GUIDE_EN)).toHaveLength(headings(HELP_GUIDE).length);
  });

  it("picks the guide by locale", () => {
    expect(getGuide("fr")).toBe(HELP_GUIDE);
    expect(getGuide("en")).toBe(HELP_GUIDE_EN);
  });
});
