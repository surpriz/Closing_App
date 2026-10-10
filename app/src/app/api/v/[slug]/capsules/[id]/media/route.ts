import type { NextRequest } from "next/server";

import { capsulesVisibleOnLink } from "@/lib/closing/capsules/resolve";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import { mediaResponse } from "@/lib/closing/media/serve";
import { prisma } from "@/lib/db";

// Streams a seller capsule to the prospect, after the same checks as the PDF
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/capsules/[id]/media">) {
  const { slug, id } = await ctx.params;

  const link = await getLinkForViewer(slug);
  if (!link || link.document.status !== "READY") return new Response("Not found", { status: 404 });
  const access = await getViewerAccess(link);
  if (!access.allowed) return new Response("Forbidden", { status: 403 });

  const capsule = await prisma.pageCapsule.findFirst({
    where: { id, ...capsulesVisibleOnLink(link) },
    select: { blobPathname: true, contentType: true },
  });
  if (!capsule) return new Response("Not found", { status: 404 });

  return mediaResponse(request, { pathname: capsule.blobPathname, contentType: capsule.contentType });
}
