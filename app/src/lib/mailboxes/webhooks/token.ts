import { timingSafeEqual } from "node:crypto";

import { signPayload, signingSecret } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

/** `?token=` on the webhook URL, compared in constant time. Unset token: the webhooks are off. */
export function hasMailboxWebhookToken(request: Request, env: ReturnType<typeof getEnv> = getEnv()): boolean {
  const secret = env.MAILBOX_WEBHOOK_TOKEN;
  if (!secret) return false;
  const given = Buffer.from(new URL(request.url).searchParams.get("token") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Per-mailbox secret echoed by Graph in every notification; derived, so nothing extra to store. */
export function clientStateFor(mailboxId: string): string {
  return signPayload(mailboxId, signingSecret());
}

export function verifyClientState(mailboxId: string, value: string | null | undefined): boolean {
  if (!value) return false;
  const given = Buffer.from(value);
  const expected = Buffer.from(clientStateFor(mailboxId));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
