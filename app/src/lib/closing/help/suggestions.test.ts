import { describe, expect, it } from "vitest";

import { helpSuggestions } from "./suggestions";

describe("helpSuggestions", () => {
  it("offers three questions everywhere", () => {
    for (const path of [null, "/dashboard", "/documents", "/documents/abc", "/links/x", "/settings", "/equipe"]) {
      expect(helpSuggestions(path)).toHaveLength(3);
    }
  });

  it("tells a document page from the document list", () => {
    expect(helpSuggestions("/documents/abc")).not.toEqual(helpSuggestions("/documents"));
  });

  it("falls back to getting started", () => {
    expect(helpSuggestions("/dashboard")[0]).toBe("Par où commencer avec Clozer ?");
  });
});
