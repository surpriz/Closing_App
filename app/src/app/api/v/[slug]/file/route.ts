import type { NextRequest } from "next/server";

import { streamPrivateBlob } from "@/lib/blob";
import { isSupportedLocale } from "@/lib/closing/constants";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import { pitchMediaResponse } from "@/lib/closing/media/serve";
import { translatedFilePathname } from "@/lib/closing/translation/file-translation";

// Streams the private PDF to the viewer after checking the link and email gate.
// ?download=1 saves it under the document's name instead (the viewer offers it once signed).
// ?lang=en serves the PDF translated by DeepL, once done (translation/file-translation.ts).
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/file">) {
  const { slug } = await ctx.params;

  const link = await getLinkForViewer(slug);
  if (!link || link.document.status !== "READY") {
    return new Response("Not found", { status: 404 });
  }

  const access = await getViewerAccess(link);
  if (!access.allowed) return new Response("Forbidden", { status: 403 });
  // A video pitch plays in place (byte ranges for Safari), it is never downloaded
  if (link.document.kind === "VIDEO") return pitchMediaResponse(request, link.document);

  const lang = request.nextUrl.searchParams.get("lang");
  const pathname = lang
    ? isSupportedLocale(lang) && link.translationEnabled
      ? await translatedFilePathname(link.document.id, lang)
      : null
    : link.document.blobPathname;
  if (!pathname) return new Response("Not found", { status: 404 });
  const blob = await streamPrivateBlob(pathname);
  if (!blob) return new Response("Not found", { status: 404 });

  return new Response(blob.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(blob.blob.size),
      "Content-Disposition": request.nextUrl.searchParams.has("download")
        ? contentDisposition(lang ? `${link.document.name} (${lang.toUpperCase()}).pdf` : `${link.document.name}.pdf`)
        : "inline",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** RFC 6266: an ASCII fallback plus the real name, accents included. */
function contentDisposition(fileName: string) {
  const ascii = fileName.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");
  return `attachment; filename="${ascii || "document.pdf"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
