import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Reply relay addresses: r-<followupId>.<signature>@<domain>. The follow-up is found again from
 * the address the prospect wrote to, and nobody can make up an address that logs a fake reply.
 * Lowercase hex only: some mail servers lowercase the local part. Pure: the secret is passed in.
 */

const SIGNATURE_LENGTH = 12;

function sign(followupId: string, secret: string) {
  return createHmac("sha256", secret).update(`reply:${followupId}`).digest("hex").slice(0, SIGNATURE_LENGTH);
}

export function replyAddress(followupId: string, domain: string, secret: string) {
  return `r-${followupId}.${sign(followupId, secret)}@${domain}`;
}

/** The follow-up id behind a relay address, or null for any other address. */
export function parseReplyAddress(address: string, domain: string, secret: string): string | null {
  const match = /^r-([a-z0-9]{8,40})\.([0-9a-f]+)@(.+)$/.exec(address.trim().toLowerCase());
  if (!match || match[3] !== domain.toLowerCase()) return null;
  const [, followupId, given] = match;
  const expected = sign(followupId, secret);
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  return followupId;
}
