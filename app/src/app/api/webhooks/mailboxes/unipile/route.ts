import { after, type NextRequest } from "next/server";

import { syncMailboxNow } from "@/lib/mailboxes/inbound/sync";
import { hasMailboxWebhookToken } from "@/lib/mailboxes/webhooks/token";
import { handleUnipileEvent, hasUnipileHeaderToken } from "@/lib/mailboxes/webhooks/unipile";

/**
 * Unipile events carry no content: they only say which account to look at. mail_received sets syncRequestedAt, then the
 * mail is read in after() under the sync lease (busy: the tick picks the request up). Always 202 once authenticated,
 * never a 5xx that would replay.
 */
export async function POST(request: NextRequest) {
  if (!hasMailboxWebhookToken(request) || !hasUnipileHeaderToken(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = await request.json().catch(() => null);
  try {
    const outcome = await handleUnipileEvent(payload);
    if (outcome.action === "sync") {
      const { mailboxId } = outcome;
      after(() =>
        syncMailboxNow(mailboxId, new Date()).catch((error) =>
          console.error("[mailboxes] unipile sync failed", error instanceof Error ? error.message : "unknown"),
        ),
      );
    }
  } catch (error) {
    console.error("[mailboxes] unipile event failed", error instanceof Error ? error.message : "unknown");
  }
  return Response.json({ ok: true }, { status: 202 });
}
