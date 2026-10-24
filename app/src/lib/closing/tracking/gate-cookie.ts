import { createHmac, timingSafeEqual } from "node:crypto";

// The gate cookie names the reader: signed so nobody sets someone else's email by hand.
// Bound to the link, so a cookie copied from one link opens no other.
function sign(linkId: string, email: string, secret: string) {
  return createHmac("sha256", secret).update(`gate:${linkId}:${email}`).digest("base64url");
}

// Cookies written before signing hold the plain email and last 30 days. Still accepted until
// they have all expired on their own, so no reader types their email again at the switch.
// Past this date the branch is dead code: remove it
export const LEGACY_GATE_COOKIES_UNTIL = new Date("2026-12-15T00:00:00Z");
const PLAIN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function signGateCookie(linkId: string, email: string, secret: string) {
  return `${email}.${sign(linkId, email, secret)}`;
}

/** The email the cookie holds, or null when it is tampered with (or unsigned, once the transition is over). */
export function readGateCookie(linkId: string, value: string | null | undefined, secret: string, now = new Date()) {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot > 0) {
    const email = value.slice(0, dot);
    const given = Buffer.from(value.slice(dot + 1));
    const expected = Buffer.from(sign(linkId, email, secret));
    if (given.length === expected.length && timingSafeEqual(given, expected)) return email;
  }
  return now < LEGACY_GATE_COOKIES_UNTIL && PLAIN_EMAIL.test(value) ? value : null;
}
