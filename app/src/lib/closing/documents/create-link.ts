import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

import { linkTitle } from "./link-title";

export type LinkSource = "extension_gmail" | "extension_outlook";

// One link = one proposal sent to one prospect company
export async function createDocumentLink(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  name?: string | null;
  prospect?: { email: string; name?: string | null; company?: string | null } | null;
  requireEmail: boolean;
  source?: LinkSource;
  // Inserted in an email that is not sent yet: confirmed by confirmLinkSent
  draft?: boolean;
}) {
  const [document, settings] = await Promise.all([
    prisma.document.findFirst({
      where: {
        id: input.documentId,
        organizationId: input.organizationId,
        archivedAt: null,
        status: { not: "FAILED" },
      },
      select: { id: true, name: true, docType: true, displayTitle: true },
    }),
    prisma.workspaceSettings.findUnique({
      where: { organizationId: input.organizationId },
      select: { chatEnabledByDefault: true },
    }),
  ]);
  if (!document) return null;

  const { prospect } = input;
  const title = linkTitle({ ...document, company: prospect?.company });
  const now = new Date();
  const link = await prisma.link.create({
    data: {
      slug: randomSlug(12),
      documentId: document.id,
      organizationId: input.organizationId,
      createdById: input.userId,
      name: input.name || prospect?.company || prospect?.email || (input.draft ? title : null),
      requireEmail: input.requireEmail,
      chatEnabled: settings?.chatEnabledByDefault ?? true,
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
    select: { id: true, slug: true, name: true },
  });
  return { ...link, title };
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
    select: { id: true, draftAt: true, name: true, prospects: { select: { id: true }, take: 1 } },
  });
  if (!link) return null;
  if (!link.draftAt) return link;

  const { prospect } = input;
  const addProspect = prospect && link.prospects.length === 0;
  return prisma.link.update({
    where: { id: link.id },
    data: {
      draftAt: null,
      sentAt: input.sentAt ?? new Date(),
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
