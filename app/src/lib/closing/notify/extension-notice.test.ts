import { describe, expect, it } from "vitest";

import { extensionNotice } from "./extension-notice";

describe("extensionNotice", () => {
  it("quotes the question the assistant passed on", () => {
    expect(extensionNotice("PROSPECT_QUESTION", "Acme", "Devis", { question: "Une remise ?" }, "fr")).toEqual({
      title: "Acme a une question",
      body: "« Une remise ? »",
    });
  });

  it("quotes a voice comment, or points to its page while it is transcribed", () => {
    expect(extensionNotice("VOICE_COMMENT", "Acme", "Devis", { transcript: "Et la phase 2 ?" }, "fr")).toEqual({
      title: "Acme a laissé un vocal",
      body: "« Et la phase 2 ? »",
    });
    expect(extensionNotice("VOICE_COMMENT", "Acme", "Devis", { pageNumber: 4 }, "fr").body).toBe("Page 4 de « Devis ».");
  });

  it("names the document when the question is missing", () => {
    expect(extensionNotice("PROSPECT_QUESTION", "Acme", "Devis", {}, "fr").body).toBe("Sur « Devis ».");
  });

  it("gives the meeting date when the widget sent it", () => {
    expect(extensionNotice("MEETING_BOOKED", "Acme", "Devis", { meetingAt: "2026-10-20T08:00:00.000Z" }, "fr")).toEqual({
      title: "Acme a pris rendez-vous",
      body: "Rendez-vous le mardi 20 octobre à 10:00, depuis « Devis ».",
    });
    expect(extensionNotice("MEETING_BOOKED", "Acme", "Devis", { meetingAt: null }, "fr").body).toBe(
      "Depuis « Devis ». La date est dans votre agenda.",
    );
  });

  it("asks the seller to extend an expired link", () => {
    expect(extensionNotice("LINK_EXTENSION_REQUESTED", "Acme", "Devis", {}, "fr")).toEqual({
      title: "Acme demande plus de temps",
      body: "« Devis » a expiré. Prolongez-le en un clic.",
    });
  });

  it("dates the coming expiry in the seller's time zone", () => {
    const notice = extensionNotice("LINK_EXPIRING", "Acme", "Devis", { expiresAt: "2026-10-15T21:59:00Z" }, "fr", "Europe/Paris");
    expect(notice.body).toBe("« Devis » expire le jeudi 15 octobre à 23:59. Prolongez ou relancez.");
  });

  it("speaks English to an English-speaking seller", () => {
    expect(extensionNotice("PROSPECT_QUESTION", "Acme", "Quote", { question: "A discount?" }, "en")).toEqual({
      title: "Acme has a question",
      body: "“A discount?”",
    });
    const notice = extensionNotice("LINK_EXPIRING", "Acme", "Quote", { expiresAt: "2026-10-15T21:59:00Z" }, "en", "Europe/Paris");
    expect(notice.body).toBe("“Quote” expires on Thursday, October 15 at 11:59 PM. Extend or follow up.");
  });
});

describe("extensionNotice for a forward", () => {
  it("names who forwarded it to whom, and quotes the note", () => {
    expect(
      extensionNotice("DOCUMENT_FORWARDED", "Acme", "Devis", { forwardedBy: "Paul", forwardedTo: "Marie", message: "Ton avis ?" }, "fr"),
    ).toEqual({ title: "Paul a transféré votre proposition", body: "À Marie : « Ton avis ? »" });
  });

  it("says when a decision maker joins", () => {
    expect(
      extensionNotice("DOCUMENT_FORWARDED", "Acme", "Devis", {
        forwardedBy: "Paul",
        forwardedTo: "daf@acme.fr",
        forwardedToRole: "FINANCE",
        decisionMaker: true,
      }, "fr").body,
    ).toBe("À daf@acme.fr (Finance / achats) : un décideur entre dans la boucle.");
  });
});
