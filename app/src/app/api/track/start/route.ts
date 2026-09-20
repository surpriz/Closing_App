import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { inBackground } from "@/lib/closing/background";
import { VIEW_SESSION_WINDOW_MS } from "@/lib/closing/constants";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import {
  getRequestContext,
  isValidTimeZone,
} from "@/lib/closing/tracking/request-context";
import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from "@/lib/closing/tracking/visitor";
import { evaluateHotLead } from "@/lib/closing/triggers/hot-lead";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(35).optional(),
});

// Opens (or resumes) a reading session and returns its id
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const link = await getLinkForViewer(parsed.data.slug);
  if (!link || link.document.status !== "READY") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const access = await getViewerAccess(link);
  if (!access.allowed) {
    return Response.json({ error: "Email required" }, { status: 403 });
  }

  const cookieStore = await cookies();
  let visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  if (!visitorId) {
    visitorId = randomUUID();
    cookieStore.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  const context = getRequestContext(request.headers);
  // IP-based timezone on Vercel, browser timezone as fallback (local dev)
  const timezone =
    context.timezone ??
    (isValidTimeZone(parsed.data.timezone) ? parsed.data.timezone! : null);
  const locale = context.locale ?? parsed.data.locale ?? null;
  const now = new Date();

  const prospect = access.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email: access.email } },
      })
    : null;

  const recentView = await prisma.documentView.findFirst({
    where: {
      linkId: link.id,
      visitorId,
      lastSeenAt: { gte: new Date(now.getTime() - VIEW_SESSION_WINDOW_MS) },
    },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  });

  const viewId =
    recentView?.id ??
    (
      await prisma.documentView.create({
        data: {
          linkId: link.id,
          documentId: link.document.id,
          prospectId: prospect?.id,
          visitorId,
          email: access.email,
          ipHash: context.ipHash,
          country: context.country,
          region: context.region,
          city: context.city,
          latitude: context.latitude,
          longitude: context.longitude,
          timezone,
          locale,
          deviceType: context.deviceType,
          browser: context.browser,
          os: context.os,
          referrer: context.referrer,
          userAgent: context.userAgent,
          isBot: context.isBot,
        },
        select: { id: true },
      })
    ).id;

  if (prospect) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        lastSeenAt: now,
        firstSeenAt: prospect.firstSeenAt ?? now,
        timezone: prospect.timezone ?? timezone,
        locale: prospect.locale ?? locale,
        country: prospect.country ?? context.country,
      },
    });
  }

  if (!context.isBot) {
    inBackground("view-started", async () => {
      await cancelOpenFollowups(link.id, "Le prospect a ouvert la proposition", ["ANTI_GHOSTING"]);
      await evaluateHotLead(viewId, !!recentView);
      await refreshEngagementScore(link.id);
    });
  }

  return Response.json({ viewId, resumed: !!recentView });
}
