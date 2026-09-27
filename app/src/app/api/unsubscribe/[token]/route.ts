import type { NextRequest } from "next/server";

import { unsubscribeByToken } from "@/lib/closing/unsubscribe";

// RFC 8058 one-click unsubscribe, POSTed by mail clients from the
// List-Unsubscribe header. No GET on purpose: link scanners would trigger it.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const ok = await unsubscribeByToken(token);
  return new Response(null, { status: ok ? 200 : 404 });
}
