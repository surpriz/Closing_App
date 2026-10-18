import type { NextRequest } from "next/server";

import { HOUR_MS } from "@/lib/closing/constants";
import { getViewerAccess, resolveViewerLink } from "@/lib/closing/links";
import { notifySeller } from "@/lib/closing/notify/notify";
import {
  deadOpenKey,
  deadState,
  REVIVAL_ALERTS_PER_LINK_HOUR,
  REVIVAL_RECORDS_PER_LINK_HOUR,
} from "@/lib/closing/revival";
import { findRevivalReader, revivalPayload } from "@/lib/closing/revival-reader";
import { getRequestContext } from "@/lib/closing/tracking/request-context";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";
import { isWorkspaceMember } from "@/lib/session";

/**
 * Someone stayed on a dead link's page: the interest is back, even without a
 * click. Sent by the page once it runs in a browser and the reader lingers,
 * never on the GET, which mail scanners make for every link of an email.
 * Always 204: the answer tells a caller nothing.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/dead-open">) {
  const { slug } = await ctx.params;
  const done = () => new Response(null, { status: 204 });

  const resolved = await resolveViewerLink(slug);
  if (!resolved || resolved.state === "open") return done();
  const { link } = resolved;
  const now = new Date();
  const dead = deadState(link, now);
  if (!dead || link.isOnboardingTest) return done();

  const context = getRequestContext(request.headers);
  if (context.isBot || (await isWorkspaceMember(link.organizationId))) return done();

  const { prospect, who, asked } = await findRevivalReader(link, dead, {
    email: (await getViewerAccess(link)).email,
    visitorId: request.cookies.get(VISITOR_COOKIE)?.value,
    ipHash: context.ipHash,
  });
  // They already asked: the seller has the louder alert
  if (asked) return done();

  const recent = await prisma.sellerAlert.count({
    where: { linkId: link.id, type: "DEAD_LINK_OPENED", createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
  });
  if (recent >= REVIVAL_RECORDS_PER_LINK_HOUR) return done();

  await notifySeller({
    linkId: link.id,
    type: "DEAD_LINK_OPENED",
    dedupeKey: deadOpenKey(link.id, dead, who),
    payload: revivalPayload(prospect, dead),
    now,
    silent: recent >= REVIVAL_ALERTS_PER_LINK_HOUR,
  });
  return done();
}
