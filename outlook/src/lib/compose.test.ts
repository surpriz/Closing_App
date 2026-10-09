import { describe, expect, it } from "vitest";

import { addLink, base64ToBytes, firstRecipient, isPdfAttachment, linksInBody, parseContext, parseLinks } from "./compose";

describe("isPdfAttachment", () => {
  it("takes a PDF file attached from disk", () => {
    expect(isPdfAttachment({ id: "a1", name: "Devis.PDF", attachmentType: "file" })).toBe(true);
    expect(isPdfAttachment({ id: "a1", name: "devis", contentType: "application/pdf" })).toBe(true);
    // Mac sends the type as a number in the event details
    expect(isPdfAttachment({ id: "a1", name: "devis.pdf", attachmentType: 0 })).toBe(true);
    expect(isPdfAttachment({ id: "a1", name: "devis.pdf", attachmentType: 2 })).toBe(false);
  });

  it("leaves the rest alone", () => {
    expect(isPdfAttachment({ id: "a1", name: "devis.docx", attachmentType: "file" })).toBe(false);
    expect(isPdfAttachment({ id: "a1", name: "devis.pdf", attachmentType: "cloud" })).toBe(false);
    expect(isPdfAttachment({ id: "a1", name: "devis.pdf", isInline: true })).toBe(false);
    expect(isPdfAttachment({ id: "", name: "devis.pdf" })).toBe(false);
    expect(isPdfAttachment(null)).toBe(false);
  });
});

describe("firstRecipient", () => {
  it("normalizes the first usable address", () => {
    expect(
      firstRecipient([
        { emailAddress: "", displayName: "Liste interne" },
        { emailAddress: "Marie.Dupont@Acme.fr", displayName: "Marie Dupont" },
      ]),
    ).toEqual({ email: "marie.dupont@acme.fr", displayName: "Marie Dupont" });
  });

  it("is null without recipients", () => {
    expect(firstRecipient([])).toBeNull();
    expect(firstRecipient(undefined)).toBeNull();
  });
});

describe("base64ToBytes", () => {
  it("decodes", () => {
    expect([...base64ToBytes(btoa("%PDF-"))]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });
});

describe("inserted links", () => {
  const a = { id: "l1", url: "https://app.clozer.club/v/abc123" };
  const b = { id: "l2", url: "https://app.clozer.club/v/def456" };

  it("round-trips and dedupes", () => {
    const links = addLink(addLink(parseLinks(null), a), { ...a });
    expect(parseLinks(JSON.stringify(addLink(links, b)))).toEqual([a, b]);
  });

  it("ignores garbage", () => {
    expect(parseLinks("{")).toEqual([]);
    expect(parseLinks('[{"id":1}]')).toEqual([]);
  });

  it("keeps only the links still in the body", () => {
    const body = `<p>Bonjour</p><a href="https://app.clozer.club/v/abc123">Devis</a>`;
    expect(linksInBody([a, b], body)).toEqual([a]);
  });
});

describe("parseContext", () => {
  it("reads the attachment id of the notice action", () => {
    expect(parseContext('{"attachmentId":"AAMk="}')).toEqual({ attachmentId: "AAMk=" });
    expect(parseContext("")).toEqual({});
    expect(parseContext("nope")).toEqual({});
  });
});
