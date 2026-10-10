import type { NextRequest } from "next/server";

import { mediaResponse } from "@/lib/closing/media/serve";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/session";

// The seller listens to a prospect's voice comment from the deal page
export async function GET(request: NextRequest, ctx: RouteContext<"/api/voice-comments/[id]/audio">) {
  const { id } = await ctx.params;

  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });

  const comment = await prisma.voiceComment.findFirst({
    where: { id, link: { organizationId: workspace.organization.id } },
    select: { blobPathname: true, contentType: true },
  });
  if (!comment) return new Response("Not found", { status: 404 });

  return mediaResponse(request, { pathname: comment.blobPathname, contentType: comment.contentType });
}
