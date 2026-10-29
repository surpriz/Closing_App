import { after, type NextRequest } from "next/server";

import { mailboxWebhooksEnabled } from "@/lib/mailboxes/config";
import { ensureUnipileWebhook } from "@/lib/mailboxes/gmail/unipile";
import { hasMailboxWebhookToken } from "@/lib/mailboxes/webhooks/token";
import { handleUnipileNotify } from "@/lib/mailboxes/webhooks/unipile";
import { verifyNotifySignature } from "@/lib/mailboxes/webhooks/unipile-secrets";

/**
 * Hosted-auth result from Unipile. Token and a signature of the state id (issued with the link) must both match;
 * then an immediate 200 and the work in the background: a retry would not change the outcome.
 */
export async function POST(request: NextRequest) {
  if (!hasMailboxWebhookToken(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const name = payload && typeof payload === "object" ? (payload as { name?: unknown }).name : null;
  let signed = false;
  try {
    signed = verifyNotifySignature(typeof name === "string" ? name : null, request.nextUrl.searchParams.get("sig"));
  } catch {
    // no signing secret configured: nothing can be trusted
  }
  if (!signed) return Response.json({ error: "unauthorized" }, { status: 401 });

  after(async () => {
    try {
      const result = await handleUnipileNotify(payload);
      if (result.outcome === "connected" && mailboxWebhooksEnabled()) await ensureUnipileWebhook();
    } catch (error) {
      console.error("[mailboxes] unipile notify failed", error instanceof Error ? error.message : "unknown");
    }
  });
  return Response.json({ ok: true }, { status: 200 });
}
