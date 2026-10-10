import type { NextRequest } from "next/server";
import { z } from "zod";

import { capsulesVisibleOnLink } from "@/lib/closing/capsules/resolve";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import { resolveViewerView } from "@/lib/closing/tracking/viewer-view";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ viewId: z.string().max(64).nullish() });

// The prospect opened a seller capsule: shown on the deal page, once per reading session
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/capsules/[id]/play">) {
  const { slug, id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });

  const link = await getLinkForViewer(slug);
  if (!link || link.document.status !== "READY") return Response.json({ error: "not_found" }, { status: 404 });
  const access = await getViewerAccess(link);
  if (!access.allowed) return Response.json({ error: "email_required" }, { status: 403 });

  const capsule = await prisma.pageCapsule.findFirst({
    where: { id, ...capsulesVisibleOnLink(link) },
    select: { id: true, pageNumber: true },
  });
  if (!capsule) return Response.json({ error: "not_found" }, { status: 404 });

  const view = await resolveViewerView(link.id, parsed.data.viewId);
  // Unlike chat and voice, the seller testing the link is left out too: a play is a prospect signal
  if (view && !view.isBot) {
    await prisma.capsulePlay.createMany({
      data: [{ capsuleId: capsule.id, linkId: link.id, viewId: view.id, pageNumber: capsule.pageNumber }],
      skipDuplicates: true,
    });
  }
  return new Response(null, { status: 204 });
}
