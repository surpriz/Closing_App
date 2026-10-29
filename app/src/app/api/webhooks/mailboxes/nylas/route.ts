import type { NextRequest } from "next/server";
import { after } from "next/server";

import { getEnv } from "@/lib/env";
import { syncMailboxNow } from "@/lib/mailboxes/inbound/sync";
import { hasMailboxWebhookToken } from "@/lib/mailboxes/webhooks/token";
import { handleNylasEvent, nylasChallenge, verifyNylasSignature } from "@/lib/mailboxes/webhooks/nylas";

/** Nylas checks the endpoint once when the webhook is registered: echo the challenge as plain text. */
export async function GET(request: NextRequest) {
  if (!hasMailboxWebhookToken(request)) return new Response(null, { status: 401 });
  const challenge = nylasChallenge(new URL(request.url).searchParams.get("challenge"));
  if (!challenge) return new Response(null, { status: 400 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" } });
}

/** Signed with the webhook secret over the raw body. 200 once verified, whatever happens after: no replay loops. */
export async function POST(request: NextRequest) {
  if (!hasMailboxWebhookToken(request)) return new Response(null, { status: 401 });
  const raw = await request.text();
  if (!verifyNylasSignature(raw, request.headers.get("x-nylas-signature"), getEnv().NYLAS_WEBHOOK_SECRET)) {
    return new Response(null, { status: 401 });
  }
  try {
    const { syncMailboxIds } = await handleNylasEvent(JSON.parse(raw));
    for (const id of syncMailboxIds) {
      after(() =>
        syncMailboxNow(id, new Date()).catch((error) =>
          console.error("[mailboxes] nylas sync failed", error instanceof Error ? error.message : "unknown"),
        ),
      );
    }
  } catch (error) {
    console.error("[mailboxes] nylas webhook failed", error instanceof Error ? error.message : "unknown");
  }
  return Response.json({ ok: true });
}
