import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { captureProductEvent } from "@/lib/analytics/server";
import { inBackground } from "@/lib/closing/background";
import { emitReaderEvent } from "@/lib/closing/channels/engagement-webhooks";
import { VIEW_SESSION_WINDOW_MS } from "@/lib/closing/constants";
import { confirmDraftOnOpen } from "@/lib/closing/documents/create-link";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { markForwardsOpened } from "@/lib/closing/forward/forward";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import {
  getRequestContext,
  isValidTimeZone,
} from "@/lib/closing/tracking/request-context";
import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from "@/lib/closing/tracking/visitor";
import { followupOfLink, markFollowupClicked } from "@/lib/closing/followups/attribution";
import { evaluateReaders } from "@/lib/closing/triggers/committee";
import { evaluateHotLead } from "@/lib/closing/triggers/hot-lead";
import { campaignProspectFor, claimCampaignClick } from "@/lib/outreach/attribution";
import { evaluateEnrollmentReading } from "@/lib/outreach/reading";
import { prisma } from "@/lib/db";
import { consumeLimit, perLink, tooManyRequests } from "@/lib/rate-limit";
import { isWorkspaceMember } from "@/lib/session";

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(35).optional(),
  // ?r= on the link of a follow-up: the message that brought the reader back
  followupId: z.string().max(40).nullish(),
  // ?c= on the link of a campaign message
  campaignMessageId: z.string().max(40).nullish(),
  // False at page load, true at the reader's first gesture: mail scanners never make one.
  // Missing (a page loaded before this field): a human, as before
  human: z.boolean().optional(),
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
  if (!(await consumeLimit("trackStart", request.headers, perLink(request.headers, link.id)))) return tooManyRequests();

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
  // Treated like a bot from here on: kept for the record, never counted
  const fromSeller = await isWorkspaceMember(link.organizationId);
  const excluded = context.isBot || fromSeller;
  // Not a gesture yet: the view is kept like a bot's until the reader confirms it
  const pending = parsed.data.human === false;
  // IP-based timezone on Vercel, browser timezone as fallback (local dev)
  const timezone =
    context.timezone ??
    (isValidTimeZone(parsed.data.timezone) ? parsed.data.timezone! : null);
  const locale = context.locale ?? parsed.data.locale ?? null;
  const now = new Date();

  const gated = access.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email: access.email } },
      })
    : null;
  const prospect = gated;

  const recentView = await prisma.documentView.findFirst({
    where: {
      linkId: link.id,
      visitorId,
      lastSeenAt: { gte: new Date(now.getTime() - VIEW_SESSION_WINDOW_MS) },
    },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, isBot: true },
  });
  // The first gesture on a view opened at load: it starts counting now, as a new session would
  const confirming = !!recentView && recentView.isBot && !excluded && !pending;
  if (confirming) {
    await prisma.documentView.update({
      where: { id: recentView.id },
      data: { isBot: false, followupId: await followupOfLink(parsed.data.followupId, link.id) },
    });
  }
  const fresh = !recentView || confirming;

  // A campaign link has no gate: its reader is the enrolled address
  const campaignProspectId = gated || recentView || excluded ? null : await campaignProspectFor(link);

  const viewId =
    recentView?.id ??
    (
      await prisma.documentView.create({
        data: {
          linkId: link.id,
          documentId: link.document.id,
          prospectId: prospect?.id ?? campaignProspectId ?? undefined,
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
          isBot: excluded || pending,
          fromSeller,
          followupId: excluded || pending ? null : await followupOfLink(parsed.data.followupId, link.id),
        },
        select: { id: true },
      })
    ).id;

  if (prospect && !fromSeller) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        lastSeenAt: excluded || pending ? undefined : now,
        firstSeenAt: prospect.firstSeenAt ?? (pending ? undefined : now),
        timezone: prospect.timezone ?? timezone,
        locale: prospect.locale ?? locale,
        country: prospect.country ?? context.country,
      },
    });
  }

  if (!excluded && !pending) {
    await confirmDraftOnOpen(link.id, now);
    if (parsed.data.followupId) await markFollowupClicked(parsed.data.followupId, link.id, now);
    await claimCampaignClick(parsed.data.campaignMessageId, link.campaignProspectId, now);
    // The seller's "aha": someone opened what they sent. Nothing about the reader goes out
    if (fresh && link.createdById) {
      captureProductEvent("proposal_opened", link.createdById, { onboarding_test: link.isOnboardingTest });
    }
    inBackground("view-started", async () => {
      await cancelOpenFollowups(link.id, "openedProposal", ["ANTI_GHOSTING"]);
      // A new reader, a decision maker or a committee says more than a plain call moment
      const readerAlert = await evaluateReaders(viewId, now);
      if (!readerAlert) await evaluateHotLead(viewId, !fresh, now);
      await refreshEngagementScore(link.id);
    });
    // A new session on a campaign link: its enrollment reads the signals now rather than at the next tick
    if (fresh && link.campaignProspectId) {
      inBackground("outreach-read", () => evaluateEnrollmentReading(link.id, now));
    }
    // Someone a reader forwarded it to: opened, once per forward, and the forwarder told if they asked
    if (prospect) inBackground("forward-opened", () => markForwardsOpened(prospect.id, now));
    // A Smart Link reader really reading: their cold email sequence can stop. Apart, so nothing above can skip it
    if (link.parentLinkId) inBackground("reader-opened", () => emitReaderEvent(link.id, "reader.opened"));
  }

  return Response.json({ viewId, resumed: !fresh });
}
