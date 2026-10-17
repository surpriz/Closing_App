import { afterEach, describe, expect, it } from "vitest";

import { COPIES, COPY, getLocale, pickLocale, setLocale, type Locale } from "./copy";

const LOCALES = Object.keys(COPIES) as Locale[];
const LONG_NAME = `${"x".repeat(60)}.pdf`;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("copy", () => {
  it("has the same keys in every language", () => {
    expect(Object.keys(COPIES.en).sort()).toEqual(Object.keys(COPIES.fr).sort());
  });

  it.each(LOCALES)("has no empty string (%s)", (locale) => {
    for (const text of strings(COPIES[locale])) expect(text.trim()).not.toBe("");
  });

  it.each(LOCALES)("keeps notice actions within Outlook's 30 characters (%s)", (locale) => {
    const copy = COPIES[locale];
    for (const action of [copy.connect, copy.replaceWithLink, copy.seeLink]) expect(action.length).toBeLessThanOrEqual(30);
  });

  it.each(LOCALES)("leaves room for the file name in Outlook's 150-character notices (%s)", (locale) => {
    const copy = COPIES[locale];
    // notice.ts cuts names to 60 (40 in the failure) and the result to 150: the words must fit around them
    for (const text of [copy.connectFirstNotice(LONG_NAME), copy.replacingNotice(LONG_NAME), copy.replaceQuestion(LONG_NAME)]) {
      expect(text.length).toBeLessThanOrEqual(150);
    }
    expect(`${copy.replacedNotice(LONG_NAME)} ${copy.removeAttachment}`.length).toBeLessThanOrEqual(150);
    expect(copy.failedNotice("x".repeat(40), copy.unexpectedReason).length).toBeLessThanOrEqual(150);
  });

  it.each(LOCALES)("uses no em dash (%s)", (locale) => {
    for (const text of strings(COPIES[locale])) expect(text).not.toContain("—");
  });

  it("names the seller's address in the connected line", () => {
    expect(COPIES.fr.connected("marie@acme.fr")).toBe("Connecté · marie@acme.fr");
    expect(COPIES.en.connected("marie@acme.com")).toBe("Connected · marie@acme.com");
  });

  it("counts several PDFs in the question", () => {
    expect(COPIES.fr.replaceQuestion("a.pdf", 3)).toBe("Remplacer ces 3 PDF par un lien Clozer ?");
    expect(COPIES.en.replaceQuestion("a.pdf", 3)).toBe("Replace these 3 PDFs with a Clozer link?");
    expect(COPIES.en.replaceQuestion("a.pdf")).toBe("Replace “a.pdf” with a Clozer link?");
  });
});

describe("locale", () => {
  const initial = getLocale();
  afterEach(() => setLocale(initial));

  it("reads French from any fr tag, English otherwise", () => {
    expect(pickLocale("fr")).toBe("fr");
    expect(pickLocale("fr-FR")).toBe("fr");
    expect(pickLocale("FR-ca")).toBe("fr");
    expect(pickLocale("en-US")).toBe("en");
    expect(pickLocale("de-DE")).toBe("en");
    expect(pickLocale("")).toBe("en");
    expect(pickLocale(undefined)).toBe("en");
  });

  it("switches COPY in place for every importer", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(COPY.connect).toBe("Connect Clozer");
    setLocale("fr");
    expect(getLocale()).toBe("fr");
    expect(COPY.connect).toBe("Connecter Clozer");
  });
});
