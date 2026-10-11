import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

import { companyFromEmail } from "../prospects/from-recipient";

/**
 * A reader gave their email on a shared link: their own link, a deal like any
 * other (score, alerts, accept, follow-ups). It starts from the shared link's
 * settings. Their follow-ups always wait for the seller: the address was
 * typed, not given by the seller.
 *
 * An existing link is reused only from a browser that already read it: typing
 * someone else's address must not open their link (a message recorded for
 * them, their signature). Elsewhere the reader gets a new link.
 */
export async function readerLinkFor(
  parent: {
    id: string;
    documentId: string;
    organizationId: string;
    createdById: string | null;
    ctaEnabled: boolean;
    bookingEnabled: boolean;
    bookingUrl: string | null;
    chatEnabled: boolean;
    voiceCommentsEnabled: boolean;
    followupsEnabled: boolean;
    expiresAt: Date | null;
  },
  email: string,
  visitorId: string | null | undefined,
  name?: string | null,
) {
  const existing = visitorId
    ? await prisma.link.findFirst({
        where: {
          parentLinkId: parent.id,
          archivedAt: null,
          prospects: { some: { email } },
          views: { some: { visitorId } },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, slug: true },
      })
    : null;
  if (existing) return existing;

  const company = companyFromEmail(email);
  return prisma.link.create({
    data: {
      slug: randomSlug(12),
      documentId: parent.documentId,
      organizationId: parent.organizationId,
      createdById: parent.createdById,
      parentLinkId: parent.id,
      name: company ?? name ?? email,
      // They just gave their email: the gate is behind them
      requireEmail: true,
      ctaEnabled: parent.ctaEnabled,
      bookingEnabled: parent.bookingEnabled,
      bookingUrl: parent.bookingUrl,
      chatEnabled: parent.chatEnabled,
      voiceCommentsEnabled: parent.voiceCommentsEnabled,
      followupsEnabled: parent.followupsEnabled,
      expiresAt: parent.expiresAt,
      sentAt: new Date(),
      prospects: { create: { email, name: name || null, company, origin: "EMAIL_GATE" } },
    },
    select: { id: true, slug: true },
  });
}
