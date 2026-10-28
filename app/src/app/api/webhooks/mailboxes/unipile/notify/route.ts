import { after, type NextRequest } from "next/server";

import { mailboxWebhooksEnabled } from "@/lib/mailboxes/config";
import { ensureUnipileWebhook } from "@/lib/mailboxes/gmail/unipile";
import { hasMailboxWebhookToken } from "@/lib/mailboxes/webhooks/token";
import { handleUnipileNotify } from "@/lib/mailboxes/webhooks/unipile";

/** Hosted-auth result from Unipile. Always 200 once the token is good: a retry would not change the outcome. */
export async function POST(request: NextRequest) {
  if (!hasMailboxWebhookToken(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => null);
  const result = await handleUnipileNotify(payload);
  if (result.outcome === "connected" && mailboxWebhooksEnabled()) {
    after(async () => {
      try {
        await ensureUnipileWebhook();
      } catch (error) {
        console.error("[mailboxes] unipile webhook registration failed", error instanceof Error ? error.message : "unknown");
      }
    });
  }
  return Response.json({ ok: true }, { status: 200 });
}
