import type { NextRequest } from "next/server";

import { streamPrivateBlob } from "@/lib/blob";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";

// Streams the private PDF to the viewer after checking the link and email gate
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v/[slug]/file">) {
  const { slug } = await ctx.params;

  const link = await getLinkForViewer(slug);
  if (!link || link.document.status !== "READY") {
    return new Response("Not found", { status: 404 });
  }

  const access = await getViewerAccess(link);
  if (!access.allowed) return new Response("Forbidden", { status: 403 });

  const blob = await streamPrivateBlob(link.document.blobPathname);
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
