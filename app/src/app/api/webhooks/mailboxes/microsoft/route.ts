import { after, type NextRequest } from "next/server";

import { syncMailbox } from "@/lib/mailboxes/inbound/sync";
import { handleMicrosoftNotifications, microsoftValidationToken } from "@/lib/mailboxes/webhooks/microsoft";
import { hasMailboxWebhookToken } from "@/lib/mailboxes/webhooks/token";

/**
 * Graph subscription endpoint. Creating a subscription sends `?validationToken=`, answered as plain text within 10 s;
 * notifications must be acknowledged with 202 within 3 s, so the sync runs in after(). Never a 5xx: Graph would retry.
 */
export async function POST(request: NextRequest) {
  if (!hasMailboxWebhookToken(request)) return new Response(null, { status: 401 });

  const asked = new URL(request.url).searchParams.get("validationToken");
  if (asked !== null) {
    const token = microsoftValidationToken(asked);
    if (!token) return new Response(null, { status: 400 });
    return new Response(token, { status: 200, headers: { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" } });
  }

  const payload = await request.json().catch(() => null);
  try {
    const { syncMailboxIds } = await handleMicrosoftNotifications(payload);
    for (const mailboxId of syncMailboxIds) {
      after(() =>
        syncMailbox(mailboxId, new Date()).catch((error) =>
          console.error("[mailboxes] microsoft sync failed", mailboxId, error instanceof Error ? error.message : "unknown"),
        ),
      );
    }
  } catch (error) {
    console.error("[mailboxes] microsoft webhook failed", error instanceof Error ? error.message : "unknown");
  }
  return new Response(null, { status: 202 });
}
