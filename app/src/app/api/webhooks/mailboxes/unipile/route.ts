import { after, type NextRequest } from "next/server";

import { syncMailbox } from "@/lib/mailboxes/inbound/sync";
import { hasMailboxWebhookToken } from "@/lib/mailboxes/webhooks/token";
import { handleUnipileEvent, hasUnipileHeaderToken } from "@/lib/mailboxes/webhooks/unipile";

/** Unipile events carry no content: they only say which account to look at. Always 202 once authenticated. */
export async function POST(request: NextRequest) {
  if (!hasMailboxWebhookToken(request) || !hasUnipileHeaderToken(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = await request.json().catch(() => null);
  try {
    const outcome = await handleUnipileEvent(payload);
    if (outcome.action === "sync") {
      after(async () => {
        try {
          await syncMailbox(outcome.mailboxId, new Date());
        } catch (error) {
          console.error("[mailboxes] unipile sync failed", outcome.mailboxId, error instanceof Error ? error.message : "unknown");
        }
      });
    }
  } catch (error) {
    // Never a 5xx: the provider would replay the event in a loop
    console.error("[mailboxes] unipile event failed", error instanceof Error ? error.message : "unknown");
  }
  return Response.json({ ok: true }, { status: 202 });
}
