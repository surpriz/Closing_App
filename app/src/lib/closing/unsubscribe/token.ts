import { createHmac, timingSafeEqual } from "node:crypto";

// Unsubscribe links carry `<prospectId>.<signature>` so a prospect can opt out
// without an account, and nobody can opt out someone else by guessing ids.
// Pure: the secret is passed in, which keeps it testable.

function sign(prospectId: string, secret: string) {
  return createHmac("sha256", secret).update(`unsubscribe:${prospectId}`).digest("base64url");
}

export function createUnsubscribeToken(prospectId: string, secret: string) {
  return `${prospectId}.${sign(prospectId, secret)}`;
}

// Returns the prospect id, or null if the token was tampered with
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const prospectId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(prospectId, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return prospectId;
}
