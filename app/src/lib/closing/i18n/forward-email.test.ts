import { describe, expect, it } from "vitest";

import { forwardEmail, forwardReceiptEmail, forwardSenderName } from "./forward-email";

const input = {
  fromName: "Paul Martin",
  toName: "Marie",
  documentName: "Devis 2026",
  senderName: "Acme Conseil",
  message: "Tu peux regarder le tarif ?",
  url: "https://app.test/v/abc?f=tok",
};

describe("forwardEmail", () => {
  it("names the forwarder, quotes their note and gives the link in every locale", () => {
    for (const locale of ["en", "fr", "es", "de"]) {
      const email = forwardEmail(locale, input);
      expect(email.subject, locale).toContain("Paul Martin");
      expect(email.body, locale).toContain("Tu peux regarder le tarif ?");
      expect(email.body, locale).toContain(input.url);
      expect(email.body, locale).toContain("Acme Conseil");
    }
  });

  it("reads well without a name, a note or a seller", () => {
    const email = forwardEmail("fr-FR", { ...input, toName: null, message: null, senderName: null });
    expect(email.body.startsWith("Bonjour,")).toBe(true);
    expect(email.body).not.toContain("«  »");
    expect(email.body).not.toContain("null");
  });

  it("falls back to English", () => {
    expect(forwardEmail("ja", input).subject).toBe('Paul Martin shared "Devis 2026" with you');
  });
});

describe("forwardReceiptEmail", () => {
  it("says who opened it, nothing more", () => {
    const email = forwardReceiptEmail("fr", { toName: "Marie", documentName: "Devis 2026", url: "https://app.test/v/abc" });
    expect(email.subject).toBe("Marie a ouvert « Devis 2026 »");
    expect(email.body).not.toMatch(/minute|page/i);
  });
});

describe("forwardSenderName", () => {
  it("shows the forwarder first", () => {
    expect(forwardSenderName("Paul Martin")).toBe("Paul Martin via Clozer");
  });
});
