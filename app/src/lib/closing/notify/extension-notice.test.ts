import { describe, expect, it } from "vitest";

import { extensionNotice } from "./extension-notice";

describe("extensionNotice", () => {
  it("quotes the question the assistant passed on", () => {
    expect(extensionNotice("PROSPECT_QUESTION", "Acme", "Devis", { question: "Une remise ?" })).toEqual({
      title: "Acme a une question",
      body: "« Une remise ? »",
    });
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
