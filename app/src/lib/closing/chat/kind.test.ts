import { describe, expect, it } from "vitest";

import { DOC_TYPES } from "../documents/doc-types";

import { chatKind, docNoun } from "./kind";

describe("chatKind", () => {
  it("groups document types by what a reader asks about", () => {
    expect(chatKind("QUOTE")).toBe("offer");
    expect(chatKind("TECHNICAL")).toBe("technical");
    expect(chatKind("RESUME")).toBe("profile");
    expect(chatKind("PRESENTATION")).toBe("document");
    expect(chatKind(null)).toBe("document");
  });

  it("names every document type for the model", () => {
    for (const type of DOC_TYPES) expect(docNoun(type)).not.toBe("");
    expect(docNoun("unknown")).toBe("document");
  });
});
