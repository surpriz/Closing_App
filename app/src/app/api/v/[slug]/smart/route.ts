import type { NextRequest } from "next/server";
import { z } from "zod";

import { HOUR_MS } from "@/lib/closing/constants";
import { getLinkForViewer, identifyProspect } from "@/lib/closing/links";
import { readerLinkFor } from "@/lib/closing/shared/reader-link";
import { parseSmartParams } from "@/lib/closing/shared/smart-params";
import { getRequestContext } from "@/lib/closing/tracking/request-context";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";
import { isWorkspaceMember } from "@/lib/session";

/** New readers per Smart Link per hour; beyond that they type their email. */
const SMART_READERS_PER_LINK_HOUR = 120;

const bodySchema = z.object({
  email: z.string().max(254),
  company: z.string().max(500).optional(),
  name: z.string().max(500).optional(),
});

/**
 * A Smart Link reader, sent from the viewer once the page runs in a browser:
 * the GET alone identifies nobody, since mail scanners open every link of a
 * cold email before the prospect does. On to their own link, remembered there.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/smart">) {
  const { slug } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const smart = parsed.success ? parseSmartParams(parsed.data) : null;
  if (!smart) return Response.json({ error: "Invalid body" }, { status: 400 });

  const link = await getLinkForViewer(slug);
  if (!link?.shared) return Response.json({ error: "Not found" }, { status: 404 });

  // A scanner running the page, or the seller trying their own link: the plain gate
  if (getRequestContext(request.headers).isBot || (await isWorkspaceMember(link.organizationId))) {
    return Response.json({ error: "Not identified" }, { status: 403 });
  }
  // A campaign brings clicks by the dozen an hour, a script by the thousand: past this, the plain gate
  const recent = await prisma.link.count({
    where: { parentLinkId: link.id, createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
  });
  if (recent >= SMART_READERS_PER_LINK_HOUR) return Response.json({ error: "Too many" }, { status: 429 });

  const reader = await readerLinkFor(link, smart.email, request.cookies.get(VISITOR_COOKIE)?.value, smart.name, {
    origin: "COLD_EMAIL",
    company: smart.company,
  });
  await identifyProspect(reader, smart.email);
  return Response.json({ slug: reader.slug });
}
