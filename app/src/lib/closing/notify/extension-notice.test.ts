import { describe, expect, it } from "vitest";

import { extensionNotice } from "./extension-notice";

describe("extensionNotice", () => {
  it("quotes the question the assistant passed on", () => {
    expect(extensionNotice("PROSPECT_QUESTION", "Acme", "Devis", { question: "Une remise ?" })).toEqual({
      title: "Acme a une question",
      body: "« Une remise ? »",
    });
  });

  it("quotes a voice comment, or points to its page while it is transcribed", () => {
    expect(extensionNotice("VOICE_COMMENT", "Acme", "Devis", { transcript: "Et la phase 2 ?" })).toEqual({
      title: "Acme a laissé un vocal",
      body: "« Et la phase 2 ? »",
    });
    expect(extensionNotice("VOICE_COMMENT", "Acme", "Devis", { pageNumber: 4 }).body).toBe("Page 4 de « Devis ».");
  });

  it("names the document when the question is missing", () => {
    expect(extensionNotice("PROSPECT_QUESTION", "Acme", "Devis", {}).body).toBe("Sur « Devis ».");
  });

  it("asks the seller to extend an expired link", () => {
    expect(extensionNotice("LINK_EXTENSION_REQUESTED", "Acme", "Devis", {})).toEqual({
      title: "Acme demande plus de temps",
      body: "« Devis » a expiré. Prolongez-le en un clic.",
    });
  });

  it("dates the coming expiry in the seller's time zone", () => {
    const notice = extensionNotice("LINK_EXPIRING", "Acme", "Devis", { expiresAt: "2026-10-15T21:59:00Z" }, "Europe/Paris");
    expect(notice.body).toBe("« Devis » expire le jeudi 15 octobre à 23:59. Prolongez ou relancez.");
  });
});
