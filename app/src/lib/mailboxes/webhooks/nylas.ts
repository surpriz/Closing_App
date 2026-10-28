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
 * One Nylas notification. Returns the mailboxes to sync (message.created). Carries no content: the message is
 * re-read by the connector. Unknown events and unknown grants are ignored.
 */
export async function handleNylasEvent(payload: unknown, now = new Date()): Promise<{ syncMailboxIds: string[] }> {
  const event = payload as { type?: unknown; data?: { object?: { grant_id?: unknown } } } | null;
  const type = typeof event?.type === "string" ? event.type : null;
  const grantId = event?.data?.object?.grant_id;
  if (!type || typeof grantId !== "string" || !grantId) return { syncMailboxIds: [] };

  const where = { connector: "NYLAS" as const, externalAccountId: grantId, status: "ACTIVE" as const };
  // The same Google account connected in two workspaces shares one grant: every live mailbox on it is concerned
  const mailboxes = await prisma.mailbox.findMany({ where, select: { id: true } });
  if (mailboxes.length === 0) return { syncMailboxIds: [] };
  const ids = mailboxes.map((m) => m.id);
  if (type === "message.created") {
    await prisma.mailbox.updateMany({ where: { id: { in: ids } }, data: { syncRequestedAt: now } });
    return { syncMailboxIds: ids };
  }
  if (type === "grant.expired" || type === "grant.error") {
    const detail = `nylas ${type}`;
    for (const id of ids) {
      const { count } = await prisma.mailbox.updateMany({
        where: { id, status: "ACTIVE" },
        data: { status: "ERROR", lastError: `AUTH_REVOKED: ${detail}`, lastErrorAt: now },
      });
      if (count > 0) await notifyMailboxOwner(id, "auth_revoked", detail, now);
    }
  }
  return { syncMailboxIds: [] };
}
