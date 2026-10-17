import { createHmac, timingSafeEqual } from "node:crypto";

// The forward email carries `<forwardId>.<signature>`: the recipient lands
// identified, without typing their address. The signature covers the
// recipient's email, so the token only ever identifies that one person.
// Pure: the secret is passed in, which keeps it testable.

function sign(forwardId: string, toEmail: string, secret: string) {
  return createHmac("sha256", secret).update(`forward:${forwardId}:${toEmail.toLowerCase()}`).digest("base64url");
}

export function createForwardToken(forwardId: string, toEmail: string, secret: string) {
  return `${forwardId}.${sign(forwardId, toEmail, secret)}`;
}

/** The forward id the token claims, before checking it against the recipient's email. */
export function forwardIdOf(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const id = token.slice(0, dot);
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

export function verifyForwardToken(token: string, toEmail: string, secret: string) {
  const forwardId = forwardIdOf(token);
  if (!forwardId) return false;
  const given = Buffer.from(token.slice(token.lastIndexOf(".") + 1));
  const expected = Buffer.from(sign(forwardId, toEmail, secret));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
