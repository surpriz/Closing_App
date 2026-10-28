import { describe, expect, it } from "vitest";

import { chosenLocale, getViewerLabels, pickLocale, type ViewerLabels } from "./viewer";

const LOCALES = ["en", "fr", "es", "de"] as const;

/** Every string of the labels, as "path" -> text, chatKinds included. */
function flatten(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  return Object.entries(value as Record<string, unknown>).reduce(
    (acc, [key, child]) => Object.assign(acc, flatten(child, path ? `${path}.${key}` : key)),
    {} as Record<string, string>,
  );
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const flat = Object.fromEntries(LOCALES.map((locale) => [locale, flatten(getViewerLabels(locale))])) as Record<
  (typeof LOCALES)[number],
  Record<string, string>
>;

// What the prospect reads must never suggest their reading is watched
const TRACKING_WORDS = /\b(suivi|suivie|track\w*|lu|lue|lecture|read|viewed|consult\w*|seguimiento|le[ií]do|gelesen|verfolgt)\b/i;
// The notices say exactly that, on purpose; "Version lecture de" is the reader mode of a site
const EXPLAINS_TRACKING = new Set<keyof ViewerLabels>([
  "privacyNotice",
  "privacyNoticeWeb",
  "privacyNoticeVideo",
  "chatDisclaimer",
  "readerSource",
  // Only ever shown to the signed-in seller, never to a prospect
  "sellerNotice",
  "sellerNoticeShared",
]);

describe("viewer labels", () => {
  it("have the same keys in every locale", () => {
    const reference = Object.keys(flat.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(flat[locale]).sort(), locale).toEqual(reference);
    }
  });

  it("carry the same placeholders in every locale", () => {
    for (const [key, text] of Object.entries(flat.en)) {
      for (const locale of LOCALES) {
        expect(placeholders(flat[locale][key]), `${locale}.${key}`).toEqual(placeholders(text));
      }
    }
  });

  it("offer the bar's question button in every locale", () => {
    for (const locale of LOCALES) {
      expect(getViewerLabels(locale).chatAsk, locale).toBeTruthy();
    }
  });

  it("never hint that reading is tracked outside the privacy notices", () => {
    for (const locale of LOCALES) {
      for (const [key, text] of Object.entries(flat[locale])) {
        if (EXPLAINS_TRACKING.has(key.split(".")[0] as keyof ViewerLabels)) continue;
        expect(text, `${locale}.${key}`).not.toMatch(TRACKING_WORDS);
      }
    }
  });

  it("use no em dash", () => {
    for (const locale of LOCALES) {
      for (const [key, text] of Object.entries(flat[locale])) {
        expect(text, `${locale}.${key}`).not.toContain("—");
      }
    }
  });
});

describe("pickLocale", () => {
  it("takes the best supported language and falls back to English", () => {
    expect(pickLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(pickLocale("ja,de;q=0.5")).toBe("de");
    expect(pickLocale("ja")).toBe("en");
    expect(pickLocale(null)).toBe("en");
  });
});

describe("chosenLocale", () => {
  it("keeps a language the viewer offers", () => {
    expect(chosenLocale("de")).toBe("de");
    expect(chosenLocale("pt")).toBe("pt");
  });

  it("ignores anything else", () => {
    expect(chosenLocale(undefined)).toBeNull();
    expect(chosenLocale("ja")).toBeNull();
    expect(chosenLocale("en-US")).toBeNull();
  });
});
