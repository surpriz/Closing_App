import type { NextRequest } from "next/server";

import { applySequencerEvent, sequencerWorkspace } from "@/lib/closing/sequencer/apply";
import { parseSequencerEvent } from "@/lib/closing/sequencer/event";
import { consumeLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * The seller's cold email tool (or Zapier / Make) reports a Smart Link
 * prospect who replied, unsubscribed or bounced: Clozer never sees those
 * emails, they stay in the seller's own mailbox. The token in the path names
 * the workspace and can be revoked from the Smart Link. Always 202 once the
 * token is good, whether the address is a contact or not: the answer must not
 * tell who is. 400 only when no address came at all.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/webhooks/sequencer/[token]">) {
  const { token } = await ctx.params;
  const organizationId = await sequencerWorkspace(token);
  if (!organizationId) return Response.json({ error: "Unknown token" }, { status: 404 });
  if (!(await consumeLimit("sequencer", request.headers, organizationId))) return tooManyRequests();

  const body = await request.json().catch(() => null);
  const event = parseSequencerEvent(
    body && typeof body === "object" && !Array.isArray(body) ? body : null,
    request.nextUrl.searchParams,
  );
  if (!event) {
    return Response.json(
      { error: 'Expected { "email": "...", "event": "replied" | "unsubscribed" | "bounced" }' },
      { status: 400 },
    );
  }
  if (event !== "ignored") await applySequencerEvent(organizationId, event);
  return Response.json({ ok: true }, { status: 202 });
}
