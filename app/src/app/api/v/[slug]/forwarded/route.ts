import type { NextRequest } from "next/server";
import { z } from "zod";

import { forwardRecipient } from "@/lib/closing/forward";
import { getLinkForViewer, getViewerAccess, identifyProspect } from "@/lib/closing/links";
import { getRequestContext } from "@/lib/closing/tracking/request-context";
import { isWorkspaceMember } from "@/lib/session";

const bodySchema = z.object({ token: z.string().min(3).max(256) });

/**
 * Someone a reader forwarded the link to, sent from the viewer once the page
 * runs in a browser: the GET alone identifies nobody, since mail scanners open
 * every link of an email before its reader does. The token names one address,
 * and a browser that already belongs to someone else stays theirs.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/forwarded">) {
  const { slug } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });

  const link = await getLinkForViewer(slug);
  if (!link) return Response.json({ error: "Not found" }, { status: 404 });
  if (getRequestContext(request.headers).isBot || (await isWorkspaceMember(link.organizationId))) {
    return Response.json({ error: "Not identified" }, { status: 403 });
  }

  const recipient = await forwardRecipient(link.id, parsed.data.token);
  if (!recipient) return Response.json({ error: "Not found" }, { status: 404 });

  const { email } = await getViewerAccess(link);
  if (email && email !== recipient.email) return Response.json({ error: "Other reader" }, { status: 403 });
  await identifyProspect(link, recipient.email);
  return Response.json({ ok: true });
}
