import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { consumeLimit } from "@/lib/rate-limit";
import { isWorkspaceMember } from "@/lib/session";

import { inBackground } from "../background";
import { markDealDirty } from "../brain/analyze-deal";
import { emitForwardEvent } from "../channels/engagement-webhooks";
import { effectiveRole, isDecisionRole } from "../committee/roles";
import { HOUR_MS } from "../constants";
import { pickLocale } from "../i18n/viewer";
import { getLinkForViewer, getViewerAccess, identifyProspect } from "../links";
import { notifySeller } from "../notify/notify";
import { companyFromEmail } from "../prospects/from-recipient";
import { getRequestContext } from "../tracking/request-context";
import { isCrawlerView, resolveViewerView } from "../tracking/viewer-view";
import { FORWARD_ALERTS_PER_LINK_HOUR } from "./limits";
import { countRecentForwards, isOptedOutInWorkspace, isWorkspaceMemberEmail } from "./queries";
import { decideForwardQuota } from "./quota";
import { canForward, decideRecipient, forwardTreeParent } from "./rules";
import { readerName } from "./names";
import { sendForwardEmail, sendForwardReceipt } from "./send";

export type ForwardInput = {
  slug: string;
  viewId: string | null;
  to: string;
  toName: string | null;
  message: string | null;
  /** Typed in the dialog when the reader never gave their email. */
  fromEmail: string | null;
  fromName: string | null;
  notifyOnOpen: boolean;
};

export type ForwardError = "not_found" | "seller_preview" | "identify" | "self" | "seller" | "unavailable" | "limit" | "send_failed";

/**
 * "Transférer": the recipient joins the same deal as a contact of their own
 * (they can sign), Clozer emails them the link in the forwarder's name, and
 * the seller hears who passed it to whom, with the note.
 */
export async function forwardDocument(input: ForwardInput): Promise<{ ok: true } | { ok: false; error: ForwardError }> {
  const link = await getLinkForViewer(input.slug);
  if (!link || !canForward(link)) return { ok: false, error: "not_found" };
  // The seller checking their page: nothing to forward, no alert to themselves
  if (await isWorkspaceMember(link.organizationId)) return { ok: false, error: "seller_preview" };

  // A real reading session of this browser: a script posting the form has none
  const requestHeaders = await headers();
  if (!(await consumeLimit("forward", requestHeaders))) return { ok: false, error: "limit" };
  const context = getRequestContext(requestHeaders);
  const view = await resolveViewerView(link.id, input.viewId);
  if (context.isBot || !view || isCrawlerView(view)) return { ok: false, error: "not_found" };

  const access = await getViewerAccess(link);
  // Behind an email gate, only a reader who passed it forwards
  if (!access.allowed) return { ok: false, error: "identify" };
  const fromEmail = access.email ?? input.fromEmail;
  if (!fromEmail) return { ok: false, error: "identify" };

  const now = new Date();
  const [recipientIsMember, recipientOptedOut] = await Promise.all([
    isWorkspaceMemberEmail(input.to, link.organizationId),
    isOptedOutInWorkspace(input.to, link.organizationId),
  ]);
  const refusal = decideRecipient({ fromEmail, toEmail: input.to, recipientIsMember, recipientOptedOut });
  if (refusal) return { ok: false, error: refusal };
  if (!isEmailConfigured()) return { ok: false, error: "unavailable" };

  // Remembered on this link like at the gate; also brings back a contact the seller deleted
  await identifyProspect(link, fromEmail, access.email ? undefined : (input.fromName ?? undefined));

  const forward = await prisma.$transaction(async (tx) => {
    // One forward at a time per link: parallel requests would all pass the counts below
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`forward:${link.id}`}))`;
    const quota = decideForwardQuota(
      await countRecentForwards(tx, {
        linkId: link.id,
        organizationId: link.organizationId,
        visitorId: view.visitorId,
        ipHash: context.ipHash,
        toEmail: input.to,
        now,
      }),
    );
    if (quota) return { quota };

    const [from, prospects] = await Promise.all([
      tx.prospect.findUniqueOrThrow({
        where: { linkId_email: { linkId: link.id, email: fromEmail } },
        select: { id: true },
      }),
      tx.prospect.findMany({ where: { linkId: link.id }, select: { id: true, forwardedById: true } }),
    ]);
    const to = await tx.prospect.upsert({
      where: { linkId_email: { linkId: link.id, email: input.to } },
      create: {
        linkId: link.id,
        email: input.to,
        name: input.toName,
        company: companyFromEmail(input.to),
        origin: "FORWARDED",
        forwardedById: from.id,
      },
      update: {},
      select: { id: true, name: true, origin: true, forwardedById: true },
    });
    const parent = forwardTreeParent(to, from.id, new Map(prospects.map((p) => [p.id, p.forwardedById])));
    if (parent || (!to.name && input.toName)) {
      await tx.prospect.update({
        where: { id: to.id },
        data: { ...(parent && { forwardedById: parent }), ...(!to.name && input.toName && { name: input.toName }) },
      });
    }
    const created = await tx.linkForward.create({
      data: {
        linkId: link.id,
        fromProspectId: from.id,
        toProspectId: to.id,
        viewId: view.id,
        message: input.message,
        notifyOnOpen: input.notifyOnOpen,
        locale: pickLocale(requestHeaders.get("accept-language")),
        visitorId: view.visitorId,
        ipHash: context.ipHash,
      },
      select: { id: true },
    });
    return { id: created.id };
  });
  // Already sent to them a moment ago: it went out, nothing more to do
  if ("quota" in forward) return forward.quota === "recipient_recent" ? { ok: true } : { ok: false, error: "limit" };

  // Sent before answering: the reader must know when it did not leave
  try {
    await sendForwardEmail(forward.id);
  } catch {
    return { ok: false, error: "send_failed" };
  }

  const closed = link.dealStatus === "WON" || link.dealStatus === "LOST";
  inBackground("forward", async () => {
    await notifyForward(forward.id, link.id, closed, now);
    await emitForwardEvent(forward.id);
    await markDealDirty(link.id);
  });
  return { ok: true };
}

async function notifyForward(forwardId: string, linkId: string, closed: boolean, now: Date) {
  const [forward, recentAlerts] = await Promise.all([
    prisma.linkForward.findUniqueOrThrow({
      where: { id: forwardId },
      select: {
        message: true,
        fromProspect: { select: { name: true, email: true } },
        toProspect: { select: { name: true, email: true, role: true } },
      },
    }),
    prisma.sellerAlert.count({
      where: {
        linkId,
        type: "DOCUMENT_FORWARDED",
        createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
        NOT: { channels: { isEmpty: true } },
      },
    }),
  ]);
  const role = effectiveRole(forward.toProspect);
  await notifySeller({
    linkId,
    type: "DOCUMENT_FORWARDED",
    dedupeKey: `forward:${forwardId}`,
    payload: {
      forwardedBy: forward.fromProspect ? readerName(forward.fromProspect) : null,
      forwardedTo: readerName(forward.toProspect),
      forwardedToEmail: forward.toProspect.email,
      forwardedToRole: role?.role ?? null,
      decisionMaker: isDecisionRole(role?.role),
      message: forward.message,
      // Replies from the alert go to whoever forwarded it
      prospectName: forward.fromProspect?.name ?? null,
      prospectEmail: forward.fromProspect?.email ?? null,
    },
    now,
    // A won or lost deal, or a reader forwarding to a whole list: the timeline has it
    silent: closed || recentAlerts >= FORWARD_ALERTS_PER_LINK_HOUR,
  });
}

/**
 * The recipient of one or more forwards started a real session: each forward
 * is marked opened once, and the forwarder who asked hears about it.
 */
export async function markForwardsOpened(prospectId: string, now = new Date()) {
  const pending = await prisma.linkForward.findMany({
    where: { toProspectId: prospectId, openedAt: null, sentAt: { not: null } },
    select: { id: true, notifyOnOpen: true },
  });
  if (pending.length === 0) return;
  await prisma.linkForward.updateMany({
    where: { id: { in: pending.map((f) => f.id) }, openedAt: null },
    data: { openedAt: now },
  });
  for (const forward of pending) if (forward.notifyOnOpen) await sendForwardReceipt(forward.id);
}

