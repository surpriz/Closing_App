import { createHmac, timingSafeEqual } from "node:crypto";

// The gate cookie names the reader: signed so nobody sets someone else's email by hand.
// Bound to the link, so a cookie copied from one link opens no other.
function sign(linkId: string, email: string, secret: string) {
  return createHmac("sha256", secret).update(`gate:${linkId}:${email}`).digest("base64url");
}

export function signGateCookie(linkId: string, email: string, secret: string) {
  return `${email}.${sign(linkId, email, secret)}`;
}

/** The email the cookie holds, or null when it is unsigned (written before signing) or tampered with. */
export function readGateCookie(linkId: string, value: string | null | undefined, secret: string) {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const email = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(linkId, email, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? email : null;
}
