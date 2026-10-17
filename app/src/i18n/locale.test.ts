import { describe, expect, it } from "vitest";

import { matchLocale, pickUiLocale, resolveUiLocale } from "./locale";

describe("pickUiLocale", () => {
  it("follows the browser by quality", () => {
    expect(pickUiLocale("de-DE,fr;q=0.8,en;q=0.9")).toBe("en");
    expect(pickUiLocale("fr-CA,en;q=0.5")).toBe("fr");
  });

  it("falls back to English", () => {
    expect(pickUiLocale("ja-JP")).toBe("en");
    expect(pickUiLocale(null)).toBe("en");
  });
});

describe("resolveUiLocale", () => {
  it("prefers the saved choice, then the cookie", () => {
    expect(resolveUiLocale({ saved: "fr", cookie: "en", acceptLanguage: "en" })).toBe("fr");
    expect(resolveUiLocale({ saved: null, cookie: "fr", acceptLanguage: "en" })).toBe("fr");
    expect(resolveUiLocale({ saved: "xx", cookie: "zz", acceptLanguage: "fr-FR" })).toBe("fr");
  });
});

describe("matchLocale", () => {
  it("keeps the caller's list and fallback", () => {
    expect(matchLocale("es-ES", ["en", "es"] as const, "en")).toBe("es");
  });
});
