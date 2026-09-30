import type { NextRequest } from "next/server";

import { getLinkLiveState } from "@/lib/closing/live";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/session";

// Polled by the link page: who is reading right now, and whether the page is stale
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/links/[id]/live">) {
  const { id } = await ctx.params;

  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });

  const link = await prisma.link.findFirst({
    where: { id, organizationId: workspace.organization.id, archivedAt: null },
    select: { id: true },
  });
  if (!link) return new Response("Not found", { status: 404 });

  return Response.json(await getLinkLiveState(link.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
