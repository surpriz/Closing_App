import { COPIES, setLocale, type Locale } from "@ext/copy";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { attachmentNotice, failedMessage, replacedMessage } from "./notice";

const pdf = { id: "att-1", name: "Proposition Acme.pdf", attachmentType: "file" };

// The French copy, as Outlook in French shows it
beforeEach(() => setLocale("fr"));
afterAll(() => setLocale("en"));

describe("attachmentNotice", () => {
  it("replaces a new PDF right away by default", () => {
    expect(attachmentNotice(pdf, "added", true)).toEqual({
      kind: "replace",
      attachment: pdf,
      progress: "Clozer remplace « Proposition Acme.pdf » par un lien…",
    });
  });

  it("asks first when the seller chose so", () => {
    expect(attachmentNotice(pdf, "added", true, true)).toEqual({
      kind: "show",
      message: "Remplacer « Proposition Acme.pdf » par un lien Clozer ?",
      actionText: "Remplacer par un lien",
      attachmentId: "att-1",
    });
  });

  it("asks to connect first", () => {
    const notice = attachmentNotice(pdf, "added", false);
    expect(notice).toMatchObject({ kind: "show", actionText: "Connecter Clozer", attachmentId: null });
  });

  it("clears on removal and ignores other files", () => {
    expect(attachmentNotice(pdf, "removed", true)).toEqual({ kind: "clear" });
    expect(attachmentNotice({ ...pdf, name: "photo.jpg" }, "added", true)).toEqual({ kind: "none" });
  });

  it("fits Outlook's limits", () => {
    const notice = attachmentNotice({ ...pdf, name: `${"x".repeat(300)}.pdf` }, "added", true, true);
    if (notice.kind !== "show") throw new Error("expected a notice");
    expect(notice.message.length).toBeLessThanOrEqual(150);
    expect(notice.actionText.length).toBeLessThanOrEqual(30);
    expect("Connecter Clozer".length).toBeLessThanOrEqual(30);
  });

  it("never hints that reading is followed", () => {
    for (const connected of [true, false]) {
      const notice = attachmentNotice(pdf, "added", connected, true);
      if (notice.kind === "show") expect(notice.message).not.toMatch(/suivi|track|lu |lecture|ouvert/i);
    }
  });

  it("keeps the outcome within Outlook's limit", () => {
    const long = `${"x".repeat(300)}.pdf`;
    expect(replacedMessage(long, "Pensez à retirer la pièce jointe.").length).toBeLessThanOrEqual(150);
    expect(failedMessage(long, "Ce PDF dépasse 25 Mo.")).toContain("Ce PDF dépasse 25 Mo.");
  });

  it("says what happened, and only what is left to do", () => {
    expect(replacedMessage("Devis.pdf", "")).toBe("« Devis.pdf » remplacé par un lien Clozer.");
    expect(replacedMessage("Devis.pdf", "Pensez à retirer la pièce jointe.")).toBe(
      "« Devis.pdf » remplacé par un lien Clozer. Pensez à retirer la pièce jointe.",
    );
  });
});

describe("in English", () => {
  beforeEach(() => setLocale("en"));

  it("speaks Outlook's language", () => {
    expect(attachmentNotice(pdf, "added", true)).toMatchObject({ progress: "Clozer is replacing “Proposition Acme.pdf” with a link…" });
    expect(attachmentNotice(pdf, "added", true, true)).toMatchObject({
      message: "Replace “Proposition Acme.pdf” with a Clozer link?",
      actionText: "Replace with a link",
    });
    expect(attachmentNotice(pdf, "added", false)).toMatchObject({ actionText: "Connect Clozer" });
    expect(replacedMessage("Quote.pdf", COPIES.en.removeAttachment)).toBe("“Quote.pdf” replaced with a Clozer link. Remember to remove the attachment.");
    expect(failedMessage("Quote.pdf", COPIES.en.unexpectedReason)).toBe("Clozer couldn't replace “Quote.pdf”: unexpected error.");
  });
});

describe.each(["en", "fr"] as Locale[])("Outlook's limits (%s)", (locale) => {
  beforeEach(() => setLocale(locale));
  const long = `${"x".repeat(300)}.pdf`;

  it("keeps every notice within 150 characters and every action within 30", () => {
    for (const [connected, askFirst] of [[true, true], [false, false], [true, false]]) {
      const notice = attachmentNotice({ ...pdf, name: long }, "added", connected, askFirst);
      if (notice.kind === "show") {
        expect(notice.message.length).toBeLessThanOrEqual(150);
        expect(notice.actionText.length).toBeLessThanOrEqual(30);
      }
      if (notice.kind === "replace") expect(notice.progress.length).toBeLessThanOrEqual(150);
    }
    expect(replacedMessage(long, COPIES[locale].removeAttachment).length).toBeLessThanOrEqual(150);
    expect(failedMessage(long, COPIES[locale].unreadableAttachment).length).toBeLessThanOrEqual(150);
  });

  it("never hints that reading is followed", () => {
    for (const connected of [true, false]) {
      const notice = attachmentNotice(pdf, "added", connected, true);
      if (notice.kind === "show") expect(notice.message).not.toMatch(/suivi|track|lu |lecture|ouvert|read|open/i);
    }
  });
});
