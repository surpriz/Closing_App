import { describe, expect, it } from "vitest";

import { fromBase64, splitChunks, toBase64 } from "./chunks";
import { linkHtml } from "./link-html";
import { hasPdfMagic, looksLikePdf, safeFileName } from "./pdf";
import { extractEmail, toRecipient } from "./recipients";
import { isOlder } from "./version";

describe("chunks", () => {
  it("round-trips bytes through base64 chunks", () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    const joined = [...splitChunks(bytes, 30_000)].map(fromBase64);
    const total = new Uint8Array(joined.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const chunk of joined) {
      total.set(chunk, offset);
      offset += chunk.length;
    }
    expect(total).toEqual(bytes);
    expect(joined).toHaveLength(3);
    expect(fromBase64(toBase64(new Uint8Array()))).toEqual(new Uint8Array());
  });
});

describe("pdf", () => {
  it("checks the magic bytes", () => {
    expect(hasPdfMagic(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasPdfMagic(new TextEncoder().encode("<html>"))).toBe(false);
  });

  it("recognises PDFs by type or name", () => {
    expect(looksLikePdf({ name: "devis.PDF", type: "" })).toBe(true);
    expect(looksLikePdf({ name: "x", type: "application/pdf" })).toBe(true);
    expect(looksLikePdf({ name: "x.docx", type: "application/msword" })).toBe(false);
  });

  it("makes safe file names", () => {
    expect(safeFileName("Proposition été 2026.pdf")).toBe("Proposition-ete-2026.pdf");
  });
});

describe("recipients", () => {
  it("reads an address and a name", () => {
    expect(toRecipient("Marie@Acme.fr", "Marie Dupont")).toEqual({ email: "marie@acme.fr", displayName: "Marie Dupont" });
    expect(toRecipient(null, '"Marie Dupont" <marie@acme.fr>')).toEqual({
      email: "marie@acme.fr",
      displayName: "Marie Dupont",
    });
  });

  it("drops a label that is only the address", () => {
    expect(toRecipient("marie@acme.fr", "marie@acme.fr")).toEqual({ email: "marie@acme.fr", displayName: null });
  });

  it("returns null without an address", () => {
    expect(toRecipient(null, "Marie")).toBeNull();
    expect(extractEmail("")).toBeNull();
  });
});

describe("link card", () => {
  it("escapes the title and the url", () => {
    const html = linkHtml("https://x.test/v/a?b=1&c=2", "Devis <Acme>");
    expect(html).toContain('href="https://x.test/v/a?b=1&#38;c=2"');
    expect(html).toContain("Devis &#60;Acme&#62;");
    expect(html).not.toContain("<Acme>");
  });

  it("has a plain text form", () => {
    const html = linkHtml("https://x.test/v/a", "Devis – Acme", "text");
    expect(html).toContain('<a href="https://x.test/v/a">');
    expect(html).not.toContain("<table");
  });

  it("never hints that reading is followed", () => {
    const text = (linkHtml("https://app.clozer.club/v/abc", "Proposition") + linkHtml("https://app.clozer.club/v/abc", "Proposition", "text")).toLowerCase();
    for (const word of ["suivi", "track", "notif", "lecture", "ouvert", "clozer"]) {
      expect(text.replaceAll("app.clozer.club", "")).not.toContain(word);
    }
  });
});

describe("isOlder", () => {
  it("compares dotted versions numerically", () => {
    expect(isOlder("0.2.9", "0.2.10")).toBe(true);
    expect(isOlder("0.3.0", "0.2.10")).toBe(false);
    expect(isOlder("1.0", "1.0.0")).toBe(false);
  });
});
