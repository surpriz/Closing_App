import { describe, expect, it } from "vitest";

import { getUnsubscribeCopy, unsubscribeFooter } from "./copy";

const url = "https://app.example.com/u/cm1abc.sig";

describe("unsubscribe footer", () => {
  it("follows the prospect locale and falls back to English", () => {
    expect(getUnsubscribeCopy("fr-FR").footerLink).toBe("Se désinscrire");
    expect(getUnsubscribeCopy("it-IT").footerLink).toBe("Unsubscribe");
    expect(getUnsubscribeCopy(null).footerLink).toBe("Unsubscribe");
  });

  it("puts the link in both text and html", () => {
    const footer = unsubscribeFooter(url, "fr");
    expect(footer.text).toContain(url);
    expect(footer.html).toContain(`href="${url}"`);
  });

  it("never hints that reading is tracked", () => {
    for (const locale of ["fr", "en", "es", "de"]) {
      const copy = Object.values(getUnsubscribeCopy(locale)).join(" ");
      expect(copy).not.toMatch(/\b(lu|lecture\w*|read\w*|track\w*|suivi|consult\w*|gelesen|leído|leer)\b/i);
    }
  });
});
