import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

import { getSellerPrefs, sellerTimezone } from "../notify/preferences";
import { defaultTimezone, getWorkspaceSettings } from "../settings";
import { onLinkExpiryChanged } from "../triggers/expiry";
import { linkTitle } from "./link-title";
import { linkDefaultsFor } from "./smart-defaults";

export type LinkSource = "extension_gmail" | "extension_outlook" | "outlook_addin";

// One link = one proposal sent to one prospect company
export async function createDocumentLink(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  name?: string | null;
  prospect?: { email: string; name?: string | null; company?: string | null } | null;
  /** Left out: the workspace defaults, adjusted to the document type (and again once the AI knows it). */
  requireEmail?: boolean;
  /** After it the viewer locks and the prospect can ask for more time. Left out: from the defaults. */
  expiresAt?: Date | null;
  source?: LinkSource;
  // Inserted in an email that is not sent yet: confirmed by confirmLinkSent
  draft?: boolean;
}) {
  const [document, settings, timeZone] = await Promise.all([
    prisma.document.findFirst({
      where: {
        id: input.documentId,
        organizationId: input.organizationId,
        archivedAt: null,
        status: { not: "FAILED" },
      },
      select: { id: true, name: true, docType: true, displayTitle: true },
    }),
    getWorkspaceSettings(input.organizationId),
    sellerTimeZone(input.userId, input.organizationId),
  ]);
  if (!document) return null;

  const { prospect } = input;
  const title = linkTitle({ ...document, company: prospect?.company });
  const now = new Date();
  // Sent to someone (a contact, an email from the extension): never a shared link
  const defaults = linkDefaultsFor(document.docType, settings, now, timeZone, {
    allowShared: !prospect && !input.source,
  });
  const autoSettings = input.requireEmail === undefined && input.expiresAt === undefined;
  const link = await prisma.link.create({
    data: {
      slug: randomSlug(12),
      documentId: document.id,
      organizationId: input.organizationId,
      createdById: input.userId,
      name: input.name || prospect?.company || prospect?.email || (input.draft ? title : null),
      requireEmail: input.requireEmail ?? defaults.requireEmail,
      expiresAt: input.expiresAt === undefined ? defaults.expiresAt : input.expiresAt,
      chatEnabled: defaults.chatEnabled,
      voiceCommentsEnabled: defaults.voiceCommentsEnabled,
      followupsEnabled: defaults.followupsEnabled,
      ctaEnabled: defaults.ctaEnabled,
      bookingEnabled: defaults.bookingEnabled,
      shared: defaults.shared,
      autoSettings,
      sentAt: input.draft ? null : now,
      draftAt: input.draft ? now : null,
      source: input.source ?? null,
      prospects: prospect
        ? {
            create: {
              email: prospect.email,
              name: prospect.name || null,
              company: prospect.company || null,
            },
          }
        : undefined,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      shared: true,
      requireEmail: true,
      expiresAt: true,
      ctaEnabled: true,
      chatEnabled: true,
      followupsEnabled: true,
    },
  });
  return { ...link, title };
}

/** The defaults of a personal link of this type, as of `now`. */
async function linkDefaultsAt(docType: string | null, organizationId: string, userId: string | null, now: Date) {
  const [settings, timeZone] = await Promise.all([
    getWorkspaceSettings(organizationId),
    userId ? sellerTimeZone(userId, organizationId) : defaultTimezone(),
  ]);
  return linkDefaultsFor(docType, settings, now, timeZone, { allowShared: false });
}

async function sellerTimeZone(userId: string, organizationId: string) {
  return sellerTimezone(await getSellerPrefs(userId, organizationId));
}

/**
 * The AI has just told what the document is: links still on their defaults
 * and not opened yet follow the type (a quote gets its deadline, a brochure
 * loses the "Valider" button). Returns how many links changed.
 */
export async function followDocumentType(documentId: string, now = new Date()) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      docType: true,
      organizationId: true,
      links: {
        // Never read: a prospect who opened it must not see the terms move
        where: { autoSettings: true, archivedAt: null, lastActivityAt: null, views: { none: { isBot: false } } },
        select: {
          id: true,
          createdById: true,
          source: true,
          expiresAt: true,
          ctaEnabled: true,
          bookingEnabled: true,
          shared: true,
          _count: { select: { prospects: { where: { origin: "SELLER" } } } },
        },
      },
    },
  });
  if (!document?.docType || document.links.length === 0) return 0;

  const settings = await getWorkspaceSettings(document.organizationId);
  let changed = 0;
  for (const link of document.links) {
    const timeZone = link.createdById
      ? await sellerTimeZone(link.createdById, document.organizationId)
      : defaultTimezone();
    const defaults = linkDefaultsFor(document.docType, settings, now, timeZone, {
      allowShared: !link.source && link._count.prospects === 0,
    });
    const { expiresAt, ctaEnabled, bookingEnabled, shared } = defaults;
    const same =
      link.expiresAt?.getTime() === expiresAt?.getTime() &&
      link.ctaEnabled === ctaEnabled &&
      link.bookingEnabled === bookingEnabled &&
      link.shared === shared;
    if (same) continue;

    // Only if the seller has not touched them in the meantime
    // Only if nothing changed in the meantime: the seller's own settings, a contact, the mode
    const updated = await prisma.link.updateMany({
      where: { id: link.id, autoSettings: true, shared: link.shared, prospects: { none: { origin: "SELLER" } } },
      data: {
        expiresAt,
        ctaEnabled,
        bookingEnabled,
        shared,
        ...(shared !== link.shared && { requireEmail: defaults.requireEmail, followupsEnabled: defaults.followupsEnabled }),
      },
    });
    if (updated.count === 0) continue;
    if (link.expiresAt?.getTime() !== expiresAt?.getTime()) {
      await onLinkExpiryChanged(link.id, now);
      // A shared link's readers keep its deadline, unless the seller gave one of them their own
      await prisma.link.updateMany({
        where: { parentLinkId: link.id, archivedAt: null, expiresAt: link.expiresAt },
        data: { expiresAt },
      });
    }
    changed += 1;
  }
  return changed;
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The seller pressed Send: the deal starts now, with the recipients as they were at that moment
export async function confirmLinkSent(input: {
  organizationId: string;
  linkId: string;
  prospect?: { email: string; name?: string | null; company?: string | null } | null;
  sentAt?: Date;
}) {
  const link = await prisma.link.findFirst({
    where: { id: input.linkId, organizationId: input.organizationId, archivedAt: null },
    select: {
      id: true,
      draftAt: true,
      name: true,
      autoSettings: true,
      shared: true,
      createdById: true,
      document: { select: { docType: true } },
      prospects: { select: { id: true }, take: 1 },
    },
  });
  if (!link) return null;
  if (!link.draftAt) return link;

  const { prospect } = input;
  const addProspect = prospect && link.prospects.length === 0;
  const sentAt = input.sentAt ?? new Date();
  // Sent to someone in particular: a shared draft becomes their personal link
  const personal = addProspect && link.shared;
  const defaults =
    link.autoSettings || personal
      ? await linkDefaultsAt(link.document.docType, input.organizationId, link.createdById, sentAt)
      : null;
  return prisma.link.update({
    where: { id: link.id },
    data: {
      draftAt: null,
      sentAt,
      // A default deadline runs from the send, not from the day the file was dropped
      ...(defaults && link.autoSettings && { expiresAt: defaults.expiresAt }),
      ...(defaults &&
        personal && {
          shared: false,
          requireEmail: defaults.requireEmail,
          ctaEnabled: defaults.ctaEnabled,
          bookingEnabled: defaults.bookingEnabled,
          followupsEnabled: defaults.followupsEnabled,
        }),
      // The draft was named after the document; the recipient is a better deal name
      ...(addProspect && { name: prospect.company || prospect.name || prospect.email }),
      ...(addProspect && {
        prospects: { create: { email: prospect.email, name: prospect.name || null, company: prospect.company || null } },
      }),
    },
    select: { id: true, draftAt: true, name: true },
  });
}

// Someone opened a link whose email was never confirmed sent (send detection missed it):
// it was sent after all. Returns true when the link was a draft.
export async function confirmDraftOnOpen(linkId: string, now = new Date()) {
  const updated = await prisma.link.updateMany({
    where: { id: linkId, draftAt: { not: null } },
    data: { draftAt: null, sentAt: now },
  });
  return updated.count > 0;
}

// Emails abandoned after the link was inserted
export async function archiveStaleDrafts(now = new Date()) {
  const { count } = await prisma.link.updateMany({
    where: { draftAt: { lte: new Date(now.getTime() - DRAFT_TTL_MS) }, archivedAt: null },
    data: { archivedAt: now },
  });
  return count;
}
