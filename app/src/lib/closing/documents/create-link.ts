import type { DocumentKind } from "@/generated/prisma/enums";
import { captureProductEvent } from "@/lib/analytics/server";
import { assertCanCreateLink, getWorkspacePlan } from "@/lib/billing/workspace-plan";
import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

import { viewerPath } from "../link-url";
import { getSellerPrefs, sellerTimezone } from "../notify/preferences";
import { defaultTimezone, getWorkspaceSettings } from "../settings";
import { onLinkExpiryChanged } from "../triggers/expiry";
import { linkTitle } from "./link-title";
import { linkDefaultsFor, SHARED_LINK_SETTINGS } from "./smart-defaults";

export type LinkSource = "extension_gmail" | "extension_outlook" | "outlook_addin" | "prospecting";

/**
 * One link = one proposal sent to one prospect company.
 * Throws PlanLimitError past the plan's links of the month (the tour's test link is never counted).
 */
export async function createDocumentLink(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  name?: string | null;
  prospect?: {
    email: string;
    name?: string | null;
    company?: string | null;
    origin?: "SELLER" | "PROSPECTING";
  } | null;
  /** Left out: the workspace defaults, adjusted to the document type (and again once the AI knows it). */
  requireEmail?: boolean;
  /** After it the viewer locks and the prospect can ask for more time. Left out: from the defaults. */
  expiresAt?: Date | null;
  source?: LinkSource;
  /** Left out: from the defaults. Off for contacts who never asked to hear from the seller. */
  followupsEnabled?: boolean;
  // Inserted in an email that is not sent yet: confirmed by confirmLinkSent
  draft?: boolean;
  /** The seller's own link from the welcome tour: always personal, never counted. */
  onboardingTest?: boolean;
  /** A Smart Link for a cold email sequence: every reader is named from the URL or the gate. */
  smart?: boolean;
}) {
  if (!input.onboardingTest) await assertCanCreateLink(input.organizationId);
  const [document, settings, timeZone, plan] = await Promise.all([
    prisma.document.findFirst({
      where: {
        id: input.documentId,
        organizationId: input.organizationId,
        archivedAt: null,
        status: { not: "FAILED" },
      },
      select: { id: true, name: true, kind: true, docType: true, displayTitle: true },
    }),
    getWorkspaceSettings(input.organizationId),
    sellerTimeZone(input.userId, input.organizationId),
    getWorkspacePlan(input.organizationId),
  ]);
  if (!document) return null;

  const { prospect } = input;
  const title = linkTitle({ ...document, company: prospect?.company });
  const now = new Date();
  // Sent to someone (a contact, an email from the extension): never a shared link
  const defaults = linkDefaultsFor(document.docType, settings, now, timeZone, {
    allowShared: !prospect && !input.source && !input.onboardingTest,
    kind: document.kind,
  });
  const autoSettings = !input.smart && input.requireEmail === undefined && input.expiresAt === undefined;
  const link = await prisma.link.create({
    data: {
      slug: randomSlug(12),
      documentId: document.id,
      organizationId: input.organizationId,
      createdById: input.userId,
      name: input.name || prospect?.company || prospect?.email || (input.draft ? title : null),
      requireEmail: input.smart ? SHARED_LINK_SETTINGS.requireEmail : (input.requireEmail ?? defaults.requireEmail),
      expiresAt: input.expiresAt === undefined ? defaults.expiresAt : input.expiresAt,
      // Off on the Free plan, for this link only: links sent before keep what they had
      chatEnabled: defaults.chatEnabled && plan.limits.prospectChat,
      voiceCommentsEnabled: defaults.voiceCommentsEnabled && plan.limits.voiceComments,
      translationEnabled: plan.limits.translation,
      followupsEnabled: input.followupsEnabled ?? defaults.followupsEnabled,
      ctaEnabled: defaults.ctaEnabled,
      bookingEnabled: defaults.bookingEnabled,
      shared: input.smart ? SHARED_LINK_SETTINGS.shared : defaults.shared,
      autoSettings,
      sentAt: input.draft ? null : now,
      draftAt: input.draft ? now : null,
      source: input.source ?? null,
      isOnboardingTest: input.onboardingTest ?? false,
      prospects: prospect
        ? {
            create: {
              email: prospect.email,
              name: prospect.name || null,
              company: prospect.company || null,
              origin: prospect.origin,
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
  captureProductEvent("link_created", input.userId, {
    source: input.source ?? "app",
    kind: document.kind,
    draft: !!input.draft,
    onboarding_test: !!input.onboardingTest,
  });
  return { ...link, title, path: viewerPath({ slug: link.slug, document, company: prospect?.company }) };
}

/** The defaults of a personal link of this type, as of `now`. */
async function linkDefaultsAt(
  document: { docType: string | null; kind: DocumentKind },
  organizationId: string,
  userId: string | null,
  now: Date,
) {
  const [settings, timeZone] = await Promise.all([
    getWorkspaceSettings(organizationId),
    userId ? sellerTimeZone(userId, organizationId) : defaultTimezone(),
  ]);
  return linkDefaultsFor(document.docType, settings, now, timeZone, { allowShared: false, kind: document.kind });
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
      kind: true,
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
  // A video pitch keeps the same settings whatever its transcript sounds like
  if (!document?.docType || document.kind === "VIDEO" || document.links.length === 0) return 0;

  const settings = await getWorkspaceSettings(document.organizationId);
  let changed = 0;
  for (const link of document.links) {
    const timeZone = link.createdById
      ? await sellerTimeZone(link.createdById, document.organizationId)
      : defaultTimezone();
    const defaults = linkDefaultsFor(document.docType, settings, now, timeZone, {
      allowShared: !link.source && link._count.prospects === 0,
    });
    const { ctaEnabled, bookingEnabled, shared } = defaults;
    // A deadline already there stays put: reading the document again must not slide or reopen it
    const expiresAt = link.expiresAt && defaults.expiresAt ? link.expiresAt : defaults.expiresAt;
    const same =
      link.expiresAt?.getTime() === expiresAt?.getTime() &&
      link.ctaEnabled === ctaEnabled &&
      link.bookingEnabled === bookingEnabled &&
      link.shared === shared;
    if (same) continue;

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
      document: { select: { docType: true, kind: true } },
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
      ? await linkDefaultsAt(link.document, input.organizationId, link.createdById, sentAt)
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

// Copying the address, or opening the mail client with it, is not sending it: the draft stays a draft
// (no "never opened" follow-up) until the prospect opens it or the seller says it went out
export async function markDraftCopied(linkId: string, now = new Date()) {
  await prisma.link.updateMany({
    where: { id: linkId, draftAt: { not: null }, copiedAt: null },
    data: { copiedAt: now },
  });
}

// "Pas encore": the seller has not sent it after all, stop asking
export async function forgetDraftCopied(linkId: string) {
  await prisma.link.updateMany({ where: { id: linkId, draftAt: { not: null } }, data: { copiedAt: null } });
}

// Emails abandoned after the link was inserted. A copied link may be in a prospect's inbox: it stays
export async function archiveStaleDrafts(now = new Date()) {
  const { count } = await prisma.link.updateMany({
    // A shared link waits on a sequence that may start weeks later: never tidied away
    where: { draftAt: { lte: new Date(now.getTime() - DRAFT_TTL_MS) }, archivedAt: null, copiedAt: null, shared: false },
    data: { archivedAt: now },
  });
  return count;
}
