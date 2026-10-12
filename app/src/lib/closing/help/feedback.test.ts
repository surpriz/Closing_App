import { describe, expect, it } from "vitest";

import { feedbackEmail, type FeedbackInput } from "./feedback";

const input: FeedbackInput = {
  kind: "BUG",
  summary: "Le bouton Envoyer ne répond pas sur la page du deal",
  details: "Rien ne se passe après le clic, sur Safari.",
  pathname: "/links/abc",
  user: { name: "Camille Martin", email: "camille@acme.fr" },
  workspaceName: "Acme",
  role: "member",
  userTexts: ["un", "deux", "trois", "quatre"],
};

describe("feedbackEmail", () => {
  const email = feedbackEmail(input);

  it("labels the subject with the kind", () => {
    expect(email.subject).toBe("[Clozer Bug] Le bouton Envoyer ne répond pas sur la page du deal");
    expect(email.title).toBe("Bug de Camille Martin");
  });

  it("says who, where and what", () => {
    expect(email.blocks[0]).toEqual({ kind: "quote", text: input.summary });
    expect(email.blocks[1]).toEqual({ kind: "text", text: input.details });
    const list = email.blocks.find((block) => block.kind === "list");
    expect(list).toMatchObject({
      items: [
        { text: "De", detail: "Camille Martin (camille@acme.fr)" },
        { text: "Workspace", detail: "Acme · member" },
        { text: "Page", detail: expect.stringContaining("/links/abc") },
      ],
    });
  });

  it("quotes only the last three messages", () => {
    const last = email.blocks[email.blocks.length - 1];
    expect(last).toEqual({ kind: "text", text: "« deux »\n\n« trois »\n\n« quatre »" });
  });

  it("skips empty details, page and history", () => {
    const bare = feedbackEmail({ ...input, details: "  ", pathname: null, userTexts: [], user: { name: null, email: "a@b.c" } });
    expect(bare.blocks.map((block) => block.kind)).toEqual(["quote", "list"]);
    expect(bare.title).toBe("Bug de a@b.c");
  });
});
