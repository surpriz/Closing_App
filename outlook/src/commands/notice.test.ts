import { describe, expect, it } from "vitest";

import { attachmentNotice, failedMessage, replacedMessage } from "./notice";

const pdf = { id: "att-1", name: "Proposition Acme.pdf", attachmentType: "file" };

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
    expect(replacedMessage(long, "Prospect : Marie Dupont. Le suivi démarre à l'envoi.").length).toBeLessThanOrEqual(150);
    expect(failedMessage(long, "Ce PDF dépasse 25 Mo.")).toContain("Ce PDF dépasse 25 Mo.");
  });
});
