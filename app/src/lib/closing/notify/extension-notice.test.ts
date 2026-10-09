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
});
