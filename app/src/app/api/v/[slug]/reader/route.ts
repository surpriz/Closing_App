import type { NextRequest } from "next/server";

import { getLinkForViewer, getViewerAccess, identifyProspect } from "@/lib/closing/links";
import { readerLinkFor } from "@/lib/closing/shared/reader-link";

// A reader already known on a shared link (they gave their email before): on to their own link,
// remembered there too. A page can't set the cookie, a route can.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/reader">) {
  const { slug } = await ctx.params;
  const link = await getLinkForViewer(slug);
  if (!link?.shared) return Response.redirect(new URL(`/v/${slug}`, request.url), 307);

  const access = await getViewerAccess(link);
  if (!access.email) return Response.redirect(new URL(`/v/${slug}`, request.url), 307);

  const reader = await readerLinkFor(link, access.email);
  await identifyProspect(reader, access.email);
  return Response.redirect(new URL(`/v/${reader.slug}`, request.url), 307);
}
