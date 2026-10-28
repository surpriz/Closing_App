import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db";
import { signPayload } from "@/lib/crypto";
import { notifyMailboxOwner } from "../notify-owner";

/** X-Nylas-Signature: hex HMAC-SHA256 of the raw body with the webhook secret, compared in constant time. */
export function verifyNylasSignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const given = Buffer.from(signature.trim().toLowerCase());
  const expected = Buffer.from(signPayload(rawBody, secret));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The challenge is echoed back as text: keep it to a harmless alphabet. */
export function nylasChallenge(value: string | null): string | null {
  return value && /^[\w.~-]{1,200}$/.test(value) ? value : null;
}

/**
 * One Nylas notification. Returns the mailbox to sync (message.created) or null. Carries no content: the message is
 * re-read by the connector. Unknown events and unknown grants are ignored.
 */
export async function handleNylasEvent(payload: unknown, now = new Date()): Promise<{ syncMailboxId: string | null }> {
  const event = payload as { type?: unknown; data?: { object?: { grant_id?: unknown } } } | null;
  const type = typeof event?.type === "string" ? event.type : null;
  const grantId = event?.data?.object?.grant_id;
  if (!type || typeof grantId !== "string" || !grantId) return { syncMailboxId: null };

  const where = { connector: "NYLAS" as const, externalAccountId: grantId, status: "ACTIVE" as const };
  if (type === "message.created") {
    const mailbox = await prisma.mailbox.findFirst({ where, select: { id: true } });
    if (!mailbox) return { syncMailboxId: null };
    await prisma.mailbox.update({ where: { id: mailbox.id }, data: { syncRequestedAt: now } });
    return { syncMailboxId: mailbox.id };
  }
  if (type === "grant.expired" || type === "grant.error") {
    const mailbox = await prisma.mailbox.findFirst({ where, select: { id: true } });
    if (!mailbox) return { syncMailboxId: null };
    const detail = `nylas ${type}`;
    const { count } = await prisma.mailbox.updateMany({
      where: { id: mailbox.id, status: "ACTIVE" },
      data: { status: "ERROR", lastError: `AUTH_REVOKED: ${detail}`, lastErrorAt: now },
    });
    if (count > 0) await notifyMailboxOwner(mailbox.id, "auth_revoked", detail, now);
  }
  return { syncMailboxId: null };
}
