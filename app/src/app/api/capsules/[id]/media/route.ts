import type { NextRequest } from "next/server";

import { mediaResponse } from "@/lib/closing/media/serve";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/session";

// The seller plays back a capsule from the dashboard
export async function GET(request: NextRequest, ctx: RouteContext<"/api/capsules/[id]/media">) {
  const { id } = await ctx.params;

  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });

  const capsule = await prisma.pageCapsule.findFirst({
    where: { id, document: { organizationId: workspace.organization.id } },
    select: { blobPathname: true, contentType: true },
  });
  if (!capsule) return new Response("Not found", { status: 404 });

  return mediaResponse(request, { pathname: capsule.blobPathname, contentType: capsule.contentType });
}
