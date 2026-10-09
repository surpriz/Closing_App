import { createHash, randomBytes, randomInt } from "node:crypto";

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
export function outlookConnectedEmail({ at, settingsUrl }: { at: Date; settingsUrl: string }) {
  const when = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(at);
  const text =
    `Un Outlook vient d'être connecté à votre compte Clozer (${when}).\n\n` +
    `Si c'est vous, rien à faire.\n\n` +
    `Sinon, révoquez-le tout de suite dans Réglages › Chrome et Outlook : ${settingsUrl}`;
  const html =
    `<p>Un Outlook vient d'être connecté à votre compte Clozer (${when}).</p>` +
    `<p>Si c'est vous, rien à faire.</p>` +
    `<p>Sinon, révoquez-le tout de suite dans <a href="${settingsUrl}">Réglages › Chrome et Outlook</a>.</p>`;
  return { subject: "Outlook connecté à votre compte Clozer", text, html };
}
