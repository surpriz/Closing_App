import type { NextRequest } from "next/server";

import { hasMailboxWebhookToken } from "@/lib/mailboxes/webhooks/token";
import { handleUnipileEvent, hasUnipileHeaderToken } from "@/lib/mailboxes/webhooks/unipile";

/**
 * Unipile events carry no content: they only say which account to look at. mail_received sets syncRequestedAt and the
 * sync tick (which holds the lease) reads the mail. Always 202 once authenticated, never a 5xx that would replay.
 */
export async function POST(request: NextRequest) {
  if (!hasMailboxWebhookToken(request) || !hasUnipileHeaderToken(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = await request.json().catch(() => null);
  try {
    await handleUnipileEvent(payload);
  } catch (error) {
    console.error("[mailboxes] unipile event failed", error instanceof Error ? error.message : "unknown");
  }
  return Response.json({ ok: true }, { status: 202 });
}
