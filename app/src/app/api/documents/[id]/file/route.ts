import type { NextRequest } from "next/server";

import { streamPrivateBlob } from "@/lib/blob";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/session";

// Streams the private PDF to its owner for the preview; never tracked
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/documents/[id]/file">) {
  const { id } = await ctx.params;

  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });

  const document = await prisma.document.findFirst({
    where: { id, organizationId: workspace.organization.id, archivedAt: null },
    select: { blobPathname: true, name: true },
  });
  if (!document?.blobPathname) return new Response("Not found", { status: 404 });

  const blob = await streamPrivateBlob(document.blobPathname);
  if (!blob) return new Response("Not found", { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(blob.blob.size),
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
