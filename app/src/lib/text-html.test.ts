import { describe, expect, it } from "vitest";

import { textToHtml } from "./text-html";

const link = { url: "https://app.clozer.club/v/acme-devis-mHiTw7Wdh4uT", title: "Devis – Acme" };

describe("textToHtml", () => {
  it("keeps paragraphs and line breaks, escaped", () => {
    expect(textToHtml("Bonjour <Marie>,\n\nA & B\nC")).toBe("<p>Bonjour &lt;Marie&gt;,</p><p>A &amp; B<br>C</p>");
  });

  it("reads the proposal address as its title", () => {
    expect(textToHtml(`Le document : ${link.url}.`, link)).toBe(
      `<p>Le document : <a href="${link.url}">Devis – Acme</a>.</p>`,
    );
  });

  it("keeps the query that credits a follow-up, not the full stop after it", () => {
    expect(textToHtml(`Ici : ${link.url}?r=abc&x=1.`, link)).toBe(
      `<p>Ici : <a href="${link.url}?r=abc&amp;x=1">Devis – Acme</a>.</p>`,
    );
  });

  it("anchors an older address of the same site too", () => {
    expect(textToHtml("https://app.clozer.club/v/mHiTw7Wdh4uT", link)).toBe(
      '<p><a href="https://app.clozer.club/v/mHiTw7Wdh4uT">Devis – Acme</a></p>',
    );
  });

  it("leaves other sites alone", () => {
    expect(textToHtml("https://evil.example.com/v/mHiTw7Wdh4uT", link)).toBe(
      "<p>https://evil.example.com/v/mHiTw7Wdh4uT</p>",
    );
  });
});
