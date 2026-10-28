import { timingSafeEqual } from "node:crypto";

import { signPayload, signingSecret } from "@/lib/crypto";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Binds a hosted-auth notification to the state we issued: Unipile cannot sign, so we sign the `name` ourselves. */
export function notifySignature(stateId: string): string {
  return signPayload(`unipile-notify:${stateId}`, signingSecret());
}

export function verifyNotifySignature(stateId: string | null | undefined, sig: string | null | undefined): boolean {
  return !!stateId && !!sig && same(sig, notifySignature(stateId));
}

/** Value of the x-clozer-token header: derived, so it differs from the URL token and never travels in a URL. */
export function unipileHeaderToken(): string {
  return signPayload("unipile-webhook", signingSecret());
}

export function verifyUnipileHeaderToken(given: string | null | undefined): boolean {
  return !!given && same(given, unipileHeaderToken());
}
