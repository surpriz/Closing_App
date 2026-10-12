import { describe, expect, it } from "vitest";

import { FAQ, faqAsText, searchFaq } from "./faq";

describe("FAQ", () => {
  it("gives every section and question a unique anchor", () => {
    const ids = [...FAQ.map((section) => section.id), ...FAQ.flatMap((section) => section.items.map((item) => item.id))];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("links only inside the app", () => {
    for (const item of FAQ.flatMap((section) => section.items)) {
      if (item.link) expect(item.link.href).toMatch(/^\/[a-z]/);
    }
  });
});

describe("searchFaq", () => {
  it("returns everything for an empty query", () => {
    expect(searchFaq("  ")).toBe(FAQ);
  });

  it("ignores accents and case, and needs every word", () => {
    const found = searchFaq("EXTENSION chrome").flatMap((section) => section.items.map((item) => item.id));
    expect(found).toContain("chrome");
    expect(searchFaq("equipe inviter").flatMap((s) => s.items.map((i) => i.id))).toContain("inviter");
    expect(searchFaq("chrome zzzz")).toEqual([]);
  });

  it("drops sections left empty", () => {
    for (const section of searchFaq("whatsapp")) expect(section.items.length).toBeGreaterThan(0);
  });
});

describe("faqAsText", () => {
  it("writes each section and question for the assistant", () => {
    const text = faqAsText([{ id: "s", title: "Titre", items: [{ id: "i", q: "Question ?", a: "Réponse." }] }]);
    expect(text).toBe("## Titre\nQ: Question ?\nR: Réponse.");
  });
});
