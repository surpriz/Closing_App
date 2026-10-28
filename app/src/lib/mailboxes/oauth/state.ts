import { createHash, randomBytes } from "node:crypto";

import type { MailboxProvider } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

const STATE_TTL_MS = 10 * 60_000;
const PURGE_AFTER_MS = 60 * 60_000;

export type ConsumedOauthState = {
  organizationId: string;
  userId: string;
  provider: MailboxProvider;
  codeVerifier: string | null;
  redirectTo: string | null;
};

/** Starts an OAuth round trip: the row id is the `state` sent to the provider, the verifier never leaves the server. */
export async function createOauthState(input: {
  organizationId: string;
  userId: string;
  provider: MailboxProvider;
  redirectTo: string | null;
  now?: Date;
}): Promise<{ id: string; codeVerifier: string; codeChallenge: string }> {
  const now = input.now ?? new Date();
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const row = await prisma.mailboxOauthState.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      provider: input.provider,
      codeVerifier,
      redirectTo: input.redirectTo,
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
    },
    select: { id: true },
  });
  return { id: row.id, codeVerifier, codeChallenge };
}

/**
 * One shot: the conditional update means a replayed or expired callback gets null, never the verifier.
 * With `expected` (the session identity), a state started by someone else is neither consumed nor returned.
 */
export async function consumeOauthState(
  id: string,
  now = new Date(),
  expected?: { userId: string; organizationId: string },
): Promise<ConsumedOauthState | null> {
  const { count } = await prisma.mailboxOauthState.updateMany({
    where: { id, consumedAt: null, expiresAt: { gt: now }, ...(expected ? { userId: expected.userId, organizationId: expected.organizationId } : {}) },
    data: { consumedAt: now },
  });
  if (count === 0) return null;
  return prisma.mailboxOauthState.findUnique({
    where: { id },
    select: { organizationId: true, userId: true, provider: true, codeVerifier: true, redirectTo: true },
  });
}

/**
 * True only for a state that ran out without ever being used. A consumed state says nothing of the kind: a sibling
 * delivery is (or was) handling it. A purged one is unknown, so false too.
 */
export async function isExpiredUnusedOauthState(id: string, now = new Date()): Promise<boolean> {
  const row = await prisma.mailboxOauthState.findUnique({ where: { id }, select: { consumedAt: true, expiresAt: true } });
  return !!row && row.consumedAt === null && row.expiresAt.getTime() <= now.getTime();
}

/** Housekeeping for the sync tick: states expired for over an hour, used or not. */
export async function purgeOauthStates(now: Date): Promise<number> {
  const { count } = await prisma.mailboxOauthState.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - PURGE_AFTER_MS) } },
  });
  return count;
}
