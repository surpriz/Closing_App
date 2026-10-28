import type { NextRequest } from "next/server";

import { applySequencerEvent, sequencerSecret } from "@/lib/closing/sequencer/apply";
import { parseSequencerEvent, verifySequencerToken } from "@/lib/closing/sequencer/event";
import { consumeLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * The seller's cold email tool (or Zapier / Make) reports a Smart Link
 * prospect who replied, unsubscribed or bounced: Clozer never sees those
 * emails, they stay in the seller's own mailbox. The token in the path names
 * the workspace. Answers 200 with how many links it touched, 202 when the
 * address is unknown (nothing to do, nothing to retry).
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/webhooks/sequencer/[token]">) {
  const { token } = await ctx.params;
  const organizationId = verifySequencerToken(token, sequencerSecret());
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

  const links = await applySequencerEvent(organizationId, event);
  return Response.json({ ok: true, links }, { status: links > 0 ? 200 : 202 });
}
