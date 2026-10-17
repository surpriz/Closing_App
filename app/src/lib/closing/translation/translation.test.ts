import { describe, expect, it } from "vitest";

import {
  cleanLanguage,
  guessLanguage,
  splitHtmlBlocks,
  stripCodeFence,
  translationTarget,
} from "./translation";

describe("cleanLanguage", () => {
  it("keeps a two-letter code", () => {
    expect(cleanLanguage("FR")).toBe("fr");
    expect(cleanLanguage(" fr-FR ")).toBe("fr");
  });

  it("drops what is not a code", () => {
    expect(cleanLanguage("")).toBeNull();
    expect(cleanLanguage(null)).toBeNull();
    expect(cleanLanguage("1")).toBeNull();
  });
});

describe("guessLanguage", () => {
  it("tells the supported languages apart", () => {
    expect(
      guessLanguage(
        "Nous vous proposons une offre complète pour la rénovation de vos locaux. Les travaux sont prévus sur trois semaines, avec un suivi par notre équipe et des points réguliers sur le chantier. Le devis est valable pour un mois.",
      ),
    ).toBe("fr");
    expect(
      guessLanguage(
        "We are happy to send you our proposal for the renovation of the office. The work will take three weeks, and our team will be with you for each step of the project. This quote is valid for one month.",
      ),
    ).toBe("en");
    expect(
      guessLanguage(
        "Wir freuen uns, Ihnen unser Angebot für die Renovierung der Büros zu senden. Die Arbeiten dauern drei Wochen und unser Team ist bei jedem Schritt mit dabei. Das Angebot ist einen Monat gültig und nicht übertragbar.",
      ),
    ).toBe("de");
    expect(
      guessLanguage(
        "Le enviamos nuestra propuesta para la renovación de las oficinas. Los trabajos duran tres semanas y nuestro equipo le acompaña en cada paso del proyecto. El presupuesto es válido por un mes y sus condiciones son las del contrato.",
      ),
    ).toBe("es");
  });

  it("does not guess from too little text", () => {
    expect(guessLanguage("Devis n°42")).toBeNull();
    expect(guessLanguage("")).toBeNull();
  });
});

describe("translationTarget", () => {
  it("translates only into a language the reader picked", () => {
    expect(translationTarget(null, "fr")).toBeNull();
    expect(translationTarget("en", "fr")).toBe("en");
  });

  it("leaves the document alone in its own language", () => {
    expect(translationTarget("fr", "fr")).toBeNull();
  });

  it("translates a document of unknown language once a language is picked", () => {
    expect(translationTarget("de", null)).toBe("de");
  });
});

describe("splitHtmlBlocks", () => {
  it("cuts between top-level blocks, never inside one", () => {
    const html = "<h2>Title</h2><p>One <strong>two</strong></p><ul><li>a</li><li>b</li></ul><hr><p>End</p>";
    expect(splitHtmlBlocks(html, 30)).toEqual([
      "<h2>Title</h2>",
      "<p>One <strong>two</strong></p>",
      "<ul><li>a</li><li>b</li></ul>",
      "<hr><p>End</p>",
    ]);
  });

  it("keeps the article whole when it is short", () => {
    const html = "<p>a</p><p>b</p>";
    expect(splitHtmlBlocks(html)).toEqual([html]);
  });

  it("loses nothing", () => {
    const html = "<figure><img src=\"https://x.test/a.png\" alt=\"\"></figure><p>a</p><blockquote><p>b</p></blockquote>";
    expect(splitHtmlBlocks(html, 10).join("")).toBe(html);
  });
});

describe("stripCodeFence", () => {
  it("unwraps a fenced answer", () => {
    expect(stripCodeFence("```html\n<p>Hi</p>\n```")).toBe("<p>Hi</p>");
    expect(stripCodeFence("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});
