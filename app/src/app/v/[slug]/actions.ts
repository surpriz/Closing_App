"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { inBackground } from "@/lib/closing/background";
import { bookingUrlForLink } from "@/lib/closing/booking/link-booking";
import { analyzeDeal, markDealDirty } from "@/lib/closing/brain/analyze-deal";
import { HOUR_MS } from "@/lib/closing/constants";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { formatDeadline, isLinkExpired } from "@/lib/closing/expiry";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { pickLocale } from "@/lib/closing/i18n/viewer";
import { getPublicAppUrl } from "@/lib/app-origin";
import { SIGNER_NAME, signedEmail } from "@/lib/closing/i18n/signed-email";
import {
  getLinkForViewer,
  getViewerAccess,
  identifyProspect,
  knownRecipient,
  resolveViewerLink,
} from "@/lib/closing/links";
import { sendProspectEmail } from "@/lib/closing/prospect-email";
import { readerLinkFor } from "@/lib/closing/shared/reader-link";
import { deadState, REVIVAL_ACTION, REVIVAL_ALERT, REVIVAL_ALERTS_PER_LINK_HOUR, REVIVAL_RECORDS_PER_LINK_HOUR } from "@/lib/closing/revival";
import { findRevivalReader, revivalPayload } from "@/lib/closing/revival-reader";
import { defaultTimezone } from "@/lib/closing/settings";
import { notifySeller } from "@/lib/closing/notify/notify";
import { getRequestContext } from "@/lib/closing/tracking/request-context";
import { resolveViewerView } from "@/lib/closing/tracking/viewer-view";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";
import { consumeLimit } from "@/lib/rate-limit";
import { isEmailConfigured } from "@/lib/email";
import { isWorkspaceMember } from "@/lib/session";

export type UnlockState = { error?: "invalid_email" | "not_found" | "too_many" } | null;

const unlockSchema = z.object({
  email: z.email().max(254),
  name: z.string().max(120).optional(),
});

export async function unlockWithEmail(
  slug: string,
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  if (!(await consumeLimit("gate", await headers()))) return { error: "too_many" };
  const resolved = await resolveViewerLink(slug);
  if (!resolved) return { error: "not_found" };
  // Expired or withdrawn while the gate was open: the page now shows the locked screen
  if (resolved.state !== "open") redirect(`/v/${slug}`);
  const { link } = resolved;

  const parsed = unlockSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: "invalid_email" };

  const { email, name } = parsed.data;
  // The seller trying their shared link stays on it: no reader link for themselves
  if (link.shared && !(await isWorkspaceMember(link.organizationId))) {
    // Each reader of a shared link gets their own link, followed like any deal
    const reader = await readerLinkFor(link, email, (await cookies()).get(VISITOR_COOKIE)?.value, name);
    await identifyProspect(reader, email, name);
    redirect(`/v/${reader.slug}`);
  }
  await identifyProspect(link, email, name);
  redirect(`/v/${slug}`);
}

/**
 * "Voir le document" on the greeting: the reader says they are the person the
 * seller sent it to. Their word only, like an email typed in the gate; the
 * signature receipt going to that address is what flags a wrong claim.
 */
export async function unlockAsKnown(slug: string): Promise<UnlockState> {
  if (!(await consumeLimit("gate", await headers()))) return { error: "too_many" };
  const resolved = await resolveViewerLink(slug);
  if (!resolved) return { error: "not_found" };
  if (resolved.state !== "open") redirect(`/v/${slug}`);
  const recipient = await knownRecipient(resolved.link.id);
  // The contact changed since the page loaded: back to the plain gate
  if (!recipient) redirect(`/v/${slug}?email=1`);
  await identifyProspect(resolved.link, recipient.email);
  redirect(`/v/${slug}`);
}

export type RevivalState = {
  ok?: true;
  error?: "invalid_email" | "not_found" | "seller_preview";
} | null;

/**
 * "Demander une prolongation" on an expired link, "Redemander le document" on
 * an archived one: the only viewer action a dead link accepts. Once per person
 * per death; the seller reopens it from the dashboard and whoever asked gets
 * an email when the link opens again.
 */
export async function requestLinkRevival(
  slug: string,
  _prev: RevivalState,
  formData: FormData,
): Promise<RevivalState> {
  const resolved = await resolveViewerLink(slug);
  if (!resolved) return { error: "not_found" };
  const { link } = resolved;
  const dead = deadState(link, new Date());
  if (resolved.state === "open" || !dead) redirect(`/v/${slug}`);

  // The seller checking what the prospect sees: no alert to themselves
  if (await isWorkspaceMember(link.organizationId)) return { error: "seller_preview" };
  // The welcome tour's own test link: nobody to tell
  if (link.isOnboardingTest) return { ok: true };

  // A real buying team asks a handful of times: beyond that it is someone filling the form, store nothing
  const hourAgo = new Date(Date.now() - HOUR_MS);
  const recentRequests = await prisma.prospectAction.count({
    where: { linkId: link.id, type: REVIVAL_ACTION[dead.kind], createdAt: { gte: hourAgo } },
  });
  if (recentRequests >= REVIVAL_RECORDS_PER_LINK_HOUR) return { ok: true };

  const access = await getViewerAccess(link);
  let email = access.email;
  const typed = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email && (typed || link.requireEmail)) {
    const parsed = unlockSchema.safeParse({ email: typed });
    if (!parsed.success) return { error: "invalid_email" };
    email = parsed.data.email;
    await identifyProspect(link, email);
  }

  const requestHeaders = await headers();
  const { prospect, requestKey, asked } = await findRevivalReader(link, dead, {
    email,
    visitorId: (await cookies()).get(VISITOR_COOKIE)?.value,
    ipHash: getRequestContext(requestHeaders).ipHash,
  });
  if (asked) return { ok: true };
  // The reactivation email is written in the language they read in
  if (prospect && !prospect.locale) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { locale: pickLocale(requestHeaders.get("accept-language")) },
    });
  }

  await prisma.prospectAction.create({
    data: { linkId: link.id, prospectId: prospect?.id, type: REVIVAL_ACTION[dead.kind] },
  });

  const alertType = REVIVAL_ALERT[dead.kind];
  const recent = await prisma.sellerAlert.count({
    where: { linkId: link.id, type: alertType, createdAt: { gte: hourAgo } },
  });
  inBackground("revival-request", async () => {
    await notifySeller({
      linkId: link.id,
      type: alertType,
      dedupeKey: requestKey,
      payload: revivalPayload(prospect, dead),
      silent: recent >= REVIVAL_ALERTS_PER_LINK_HOUR,
    });
    // The analysis skips archived links anyway
    if (dead.kind === "expired") await markDealDirty(link.id);
  });

  return { ok: true };
}

const actionSchema = z.object({
  slug: z.string().min(1).max(64),
  viewId: z.string().max(64).nullable(),
  // REQUEST_QUOTE: under a video pitch, which has nothing to sign
  type: z.enum(["VALIDATE_SIGN", "REQUEST_CHANGE", "REQUEST_QUOTE"]),
  message: z.string().trim().max(2000).optional(),
  // Signing: a name typed by hand and the box ticked, nothing implied. It ends up in an
  // email to the recipient: a name only, never a link or an address someone slips in.
  signerName: z
    .string()
    .trim()
    .regex(SIGNER_NAME)
    .optional(),
  agreed: z.boolean().optional(),
});

const ALERT_FOR_ACTION = {
  VALIDATE_SIGN: "PROSPECT_VALIDATED",
  REQUEST_CHANGE: "CHANGE_REQUESTED",
  REQUEST_QUOTE: "QUOTE_REQUESTED",
} as const;

const FOLLOWUP_CANCEL_REASON = {
  VALIDATE_SIGN: "validatedByProspect",
  REQUEST_CHANGE: "changeRequestedByProspect",
  REQUEST_QUOTE: "quoteRequested",
} as const;

export async function submitProspectAction(input: z.input<typeof actionSchema>) {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { slug, viewId, type, message, signerName, agreed } = parsed.data;
  if (type === "VALIDATE_SIGN" && (!signerName || agreed !== true)) return { ok: false };

  const link = await getLinkForViewer(slug);
  // The seller (or the document type) turned the buttons off: nothing to accept
  if (!link || !link.ctaEnabled) return { ok: false };
  if ((link.document.kind === "VIDEO") !== (type === "REQUEST_QUOTE")) return { ok: false };
  // A signed quote stays readable past its deadline, but takes no new answer
  if (isLinkExpired(link, new Date())) return { ok: false };

  const access = await getViewerAccess(link);
  if (!access.allowed) return { ok: false };

  // Only attach the view if it belongs to this browser
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  const view = viewId
    ? await prisma.documentView.findFirst({
        where: { id: viewId, linkId: link.id, visitorId },
        select: { id: true },
      })
    : null;

  const prospect = access.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email: access.email } },
        select: { id: true, name: true, email: true, origin: true, locale: true, timezone: true },
      })
    : null;
  const context = getRequestContext(await headers());

  const closed = link.dealStatus === "WON" || link.dealStatus === "LOST";

  const [action] = await prisma.$transaction([
    prisma.prospectAction.create({
      data: {
        linkId: link.id,
        viewId: view?.id,
        prospectId: prospect?.id,
        type,
        message: message || null,
        ...(type === "VALIDATE_SIGN" && {
          signerName,
          signerIpHash: context.ipHash,
          signerAgent: context.userAgent?.slice(0, 500) ?? null,
          // Before READY the hash is the browser's hint, not ours
          documentSha256: link.document.status === "READY" ? link.document.contentSha256 : null,
        }),
      },
      select: { id: true, createdAt: true },
    }),
    // A quote asked for leaves the deal open (the seller's answer is still to come), and stops follow-ups for good
    ...(type === "REQUEST_QUOTE"
      ? [prisma.link.update({ where: { id: link.id }, data: { quoteRequestedAt: new Date() } })]
      : []),
    ...(closed || type === "REQUEST_QUOTE"
      ? []
      : [
          prisma.link.update({
            where: { id: link.id },
            data: { dealStatus: type === "VALIDATE_SIGN" ? "VALIDATED" : "CHANGE_REQUESTED" },
          }),
        ]),
  ]);

  // The prospect answered: automated follow-ups would now be off-key
  // The viewer tells the prospect the seller has been told: make it true
  inBackground("prospect-action-alert", () =>
    notifySeller({
      linkId: link.id,
      type: ALERT_FOR_ACTION[type],
      dedupeKey: `prospect_action:${action.id}`,
      payload: {
        message: message || null,
        prospectName: signerName ?? prospect?.name ?? null,
        prospectEmail: prospect?.email ?? access.email ?? null,
      },
    }),
  );

  inBackground("prospect-action", async () => {
    await cancelOpenFollowups(link.id, FOLLOWUP_CANCEL_REASON[type]);
    await refreshEngagementScore(link.id);
    if (type !== "VALIDATE_SIGN") await analyzeDeal(link.id, "PROSPECT_ACTION");
  });

  // A receipt only to someone the seller sent the link to: a typed email proves nothing
  const receipt = type === "VALIDATE_SIGN" && prospect?.origin === "SELLER" && isEmailConfigured();
  if (receipt && prospect && signerName) {
    inBackground("signed-receipt", () =>
      sendSignedReceipt({ link, prospect, signerName, signedAt: action.createdAt }),
    );
  }

  return { ok: true, receipt };
}

async function sendSignedReceipt(input: {
  link: { id: string; slug: string; document: { name: string } };
  prospect: { id: string; email: string; locale: string | null; timezone: string | null };
  signerName: string;
  signedAt: Date;
}) {
  const { link, prospect } = input;
  const owner = await prisma.link.findUnique({
    where: { id: link.id },
    select: {
      createdBy: { select: { email: true, name: true } },
      organization: { select: { settings: { select: { senderName: true } } } },
    },
  });
  const locale = prospect.locale ?? "fr";
  await sendProspectEmail({
    prospect,
    locale,
    replyTo: owner?.createdBy?.email,
    ...signedEmail(locale, {
      documentName: link.document.name,
      signerName: input.signerName,
      signedAt: formatDeadline(input.signedAt, locale, prospect.timezone ?? defaultTimezone(), {
        showZone: !prospect.timezone,
      }),
      senderName: owner?.organization.settings?.senderName?.trim() || owner?.createdBy?.name || null,
      url: `${getPublicAppUrl()}/v/${link.slug}`,
    }),
  });
}

const meetingSchema = z.object({
  slug: z.string().min(1).max(64),
  viewId: z.string().max(64).nullable(),
});

/** Bookings recorded per link per hour; beyond that the widget still works, nothing is stored. */
const MEETINGS_PER_LINK_HOUR = 5;

/**
 * The reader of a link that offers a booking page, in a tracked session that
 * is not a crawler's nor the seller's own test. Null = record nothing.
 */
async function meetingContext(input: z.input<typeof meetingSchema>) {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) return null;
  const link = await getLinkForViewer(parsed.data.slug);
  if (!link || !link.bookingEnabled) return null;
  // The seller trying their own link sees the widget, nothing is recorded
  if (await isWorkspaceMember(link.organizationId)) return null;
  const access = await getViewerAccess(link);
  if (!access.allowed || !(await bookingUrlForLink(link))) return null;
  const view = await resolveViewerView(link.id, parsed.data.viewId);
  if (!view || view.isBot) return null;
  const prospect = access.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email: access.email } },
        select: { id: true, name: true, email: true },
      })
    : null;
  return { link, view, prospect, email: access.email };
}

/** "Prendre rendez-vous" clicked: an intent, counted once per reading session. */
export async function recordMeetingClick(input: z.input<typeof meetingSchema>) {
  const context = await meetingContext(input);
  if (!context) return;
  const { link, view, prospect } = context;
  const already = await prisma.prospectAction.findFirst({
    where: { linkId: link.id, viewId: view.id, type: "MEETING_CLICK" },
    select: { id: true },
  });
  if (already) return;
  await prisma.prospectAction.create({
    data: { linkId: link.id, viewId: view.id, prospectId: prospect?.id, type: "MEETING_CLICK" },
  });
  inBackground("meeting-click", () => refreshEngagementScore(link.id));
}

/**
 * The Calendly or Cal.com widget confirmed a booking. The browser says so,
 * like every viewer action: worst case a forged call stops the follow-ups
 * of a link whose reader could already validate it.
 */
export async function recordMeetingBooked(input: z.input<typeof meetingSchema> & { startTime: string | null }) {
  // Cal.com gives the slot, Calendly does not (no API call here)
  const startTime = z.iso.datetime().nullable().safeParse(input.startTime);
  if (!startTime.success) return;
  const context = await meetingContext(input);
  if (!context) return;
  const { link, view, prospect, email } = context;

  const recent = await prisma.prospectAction.count({
    where: { linkId: link.id, type: "MEETING_BOOKED", createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
  });
  if (recent >= MEETINGS_PER_LINK_HOUR) return;

  const [action] = await prisma.$transaction([
    prisma.prospectAction.create({
      data: { linkId: link.id, viewId: view.id, prospectId: prospect?.id, type: "MEETING_BOOKED" },
      select: { id: true },
    }),
    // The latest booking wins: a second one replaces the slot
    prisma.link.update({
      where: { id: link.id },
      data: { meetingBookedAt: new Date(), meetingAt: startTime.data ? new Date(startTime.data) : null },
    }),
  ]);

  inBackground("meeting-booked-alert", () =>
    notifySeller({
      linkId: link.id,
      type: "MEETING_BOOKED",
      dedupeKey: `prospect_action:${action.id}`,
      payload: {
        prospectName: prospect?.name ?? null,
        prospectEmail: prospect?.email ?? email ?? null,
        meetingAt: startTime.data,
      },
    }),
  );

  inBackground("meeting-booked", async () => {
    await cancelOpenFollowups(link.id, "meetingBooked");
    await refreshEngagementScore(link.id);
    await analyzeDeal(link.id, "PROSPECT_ACTION");
  });
}
