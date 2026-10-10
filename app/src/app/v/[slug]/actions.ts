"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { inBackground } from "@/lib/closing/background";
import { analyzeDeal, markDealDirty } from "@/lib/closing/brain/analyze-deal";
import { HOUR_MS } from "@/lib/closing/constants";
import { refreshEngagementScore } from "@/lib/closing/engagement/refresh-score";
import { extensionRequestKey } from "@/lib/closing/expiry";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { pickLocale } from "@/lib/closing/i18n/viewer";
import { getPublicAppUrl } from "@/lib/app-origin";
import { formatDeadline } from "@/lib/closing/expiry";
import { SIGNER_NAME, signedEmail } from "@/lib/closing/i18n/signed-email";
import {
  getLinkForViewer,
  getViewerAccess,
  identifyProspect,
  knownRecipient,
  resolveViewerLink,
} from "@/lib/closing/links";
import { sendProspectEmail } from "@/lib/closing/prospect-email";
import { defaultTimezone } from "@/lib/closing/settings";
import { notifySeller } from "@/lib/closing/notify/notify";
import { getRequestContext } from "@/lib/closing/tracking/request-context";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { isWorkspaceMember } from "@/lib/session";

export type UnlockState = { error?: "invalid_email" | "not_found" } | null;

const unlockSchema = z.object({
  email: z.email().max(254),
  name: z.string().max(120).optional(),
});

export async function unlockWithEmail(
  slug: string,
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const resolved = await resolveViewerLink(slug);
  if (!resolved) return { error: "not_found" };
  // Expired while the gate was open: the page now shows the locked screen
  if (resolved.expired) redirect(`/v/${slug}`);
  const { link } = resolved;

  const parsed = unlockSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: "invalid_email" };

  const { email, name } = parsed.data;
  await identifyProspect(link, email, name);
  redirect(`/v/${slug}`);
}

/**
 * "Voir le document" on the greeting: the reader says they are the person the
 * seller sent it to. Their word only, like an email typed in the gate; the
 * signature receipt going to that address is what flags a wrong claim.
 */
export async function unlockAsKnown(slug: string): Promise<UnlockState> {
  const resolved = await resolveViewerLink(slug);
  if (!resolved) return { error: "not_found" };
  if (resolved.expired) redirect(`/v/${slug}`);
  const recipient = await knownRecipient(resolved.link.id);
  // The contact changed since the page loaded: back to the plain gate
  if (!recipient) redirect(`/v/${slug}?email=1`);
  await identifyProspect(resolved.link, recipient.email);
  redirect(`/v/${slug}`);
}

export type ExtensionState = {
  ok?: true;
  error?: "invalid_email" | "not_found" | "seller_preview";
} | null;

/** Pushed alerts per link per hour; beyond that they are only stored. */
const EXTENSION_ALERTS_PER_LINK_HOUR = 3;
/** Requests recorded per link per hour; beyond that the form says "sent" and does nothing. */
const EXTENSION_REQUESTS_PER_LINK_HOUR = 20;

/**
 * "Demander une prolongation" on an expired link: the only viewer action that
 * accepts one. Once per person per expiry date; the seller extends from the
 * dashboard and whoever asked gets an email when the link opens again.
 */
export async function requestLinkExtension(
  slug: string,
  _prev: ExtensionState,
  formData: FormData,
): Promise<ExtensionState> {
  const resolved = await resolveViewerLink(slug);
  if (!resolved) return { error: "not_found" };
  if (!resolved.expired) redirect(`/v/${slug}`);
  const { link } = resolved;
  const expiresAt = link.expiresAt!;

  // The seller checking what the prospect sees: no alert to themselves
  if (await isWorkspaceMember(link.organizationId)) return { error: "seller_preview" };

  // A real buying team asks a handful of times: beyond that it is someone filling the form, store nothing
  const hourAgo = new Date(Date.now() - HOUR_MS);
  const recentRequests = await prisma.prospectAction.count({
    where: { linkId: link.id, type: "REQUEST_EXTENSION", createdAt: { gte: hourAgo } },
  });
  if (recentRequests >= EXTENSION_REQUESTS_PER_LINK_HOUR) return { ok: true };

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
  const prospect = email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email } },
        select: { id: true, name: true, email: true, locale: true },
      })
    : null;
  // The reactivation email is written in the language they read in
  if (prospect && !prospect.locale) {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { locale: pickLocale(requestHeaders.get("accept-language")) },
    });
  }

  // One request per person and deadline: known by email, else by browser, else by network
  const who =
    prospect?.id ??
    (await cookies()).get(VISITOR_COOKIE)?.value ??
    getRequestContext(requestHeaders).ipHash ??
    "anonymous";
  const dedupeKey = extensionRequestKey(link.id, expiresAt, who);
  const already = await prisma.sellerAlert.findUnique({ where: { dedupeKey }, select: { id: true } });
  if (already) return { ok: true };

  await prisma.prospectAction.create({
    data: { linkId: link.id, prospectId: prospect?.id, type: "REQUEST_EXTENSION" },
  });

  const recent = await prisma.sellerAlert.count({
    where: {
      linkId: link.id,
      type: "LINK_EXTENSION_REQUESTED",
      createdAt: { gte: hourAgo },
    },
  });
  inBackground("extension-request", async () => {
    await notifySeller({
      linkId: link.id,
      type: "LINK_EXTENSION_REQUESTED",
      dedupeKey,
      payload: {
        prospectName: prospect?.name ?? null,
        prospectEmail: prospect?.email ?? null,
        expiresAt: expiresAt.toISOString(),
      },
      silent: recent >= EXTENSION_ALERTS_PER_LINK_HOUR,
    });
    await markDealDirty(link.id);
  });

  return { ok: true };
}

const actionSchema = z.object({
  slug: z.string().min(1).max(64),
  viewId: z.string().max(64).nullable(),
  type: z.enum(["VALIDATE_SIGN", "REQUEST_CHANGE"]),
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

export async function submitProspectAction(input: z.input<typeof actionSchema>) {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { slug, viewId, type, message, signerName, agreed } = parsed.data;
  if (type === "VALIDATE_SIGN" && (!signerName || agreed !== true)) return { ok: false };

  const link = await getLinkForViewer(slug);
  // The seller (or the document type) turned the buttons off: nothing to accept
  if (!link || !link.ctaEnabled) return { ok: false };

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
    ...(closed
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
      type: type === "VALIDATE_SIGN" ? "PROSPECT_VALIDATED" : "CHANGE_REQUESTED",
      dedupeKey: `prospect_action:${action.id}`,
      payload: {
        message: message || null,
        prospectName: signerName ?? prospect?.name ?? null,
        prospectEmail: prospect?.email ?? access.email ?? null,
      },
    }),
  );

  inBackground("prospect-action", async () => {
    await cancelOpenFollowups(
      link.id,
      type === "VALIDATE_SIGN" ? "Proposition validée par le prospect" : "Ajustement demandé par le prospect",
    );
    await refreshEngagementScore(link.id);
    if (type === "REQUEST_CHANGE") await analyzeDeal(link.id, "PROSPECT_ACTION");
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
