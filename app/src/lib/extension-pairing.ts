import { createHash, randomBytes, randomInt } from "node:crypto";

import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

// Device-style pairing for the Outlook add-in (see ExtensionPairing in the schema)
export const PAIRING_TTL_MS = 10 * 60 * 1000;

// No 0/O, 1/I/L, no vowels: nothing to misread, no word spelled by accident
const ALPHABET = "BCDFGHJKMNPQRSTVWXZ23456789";
const CODE_LENGTH = 8;

export function generateUserCode() {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

// "BCDFGHJK" → "BCDF-GHJK"
export function formatUserCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// What the seller typed → the stored form, or null when it can't be a code
export function normalizeUserCode(input: string) {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((char) => ALPHABET.includes(char)) ? code : null;
}

export function generatePollSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashPollSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

// Sent to the seller each time an Outlook gets a token, so a pairing they didn't
// make (someone talked them into typing a code) can be revoked right away
export function outlookConnectedEmail({
  at,
  settingsUrl,
  locale,
  timeZone = "Europe/Paris",
}: {
  at: Date;
  settingsUrl: string;
  locale: UiLocale;
  /** The seller's, when known. */
  timeZone?: string;
}) {
  const t = getNamespaceTranslator(locale, "emails.outlookConnected");
  const when = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  }).format(at);
  const text = `${t("intro", { when })}\n\n${t("ifYou")}\n\n${t("otherwise", { url: settingsUrl })}`;
  const html =
    `<p>${t("intro", { when })}</p>` +
    `<p>${t("ifYou")}</p>` +
    `<p>${t.markup("otherwiseHtml", { a: (chunks) => `<a href="${settingsUrl}">${chunks}</a>` })}</p>`;
  return { subject: t("subject"), text, html };
}
