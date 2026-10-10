import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

import { companyFromEmail } from "../prospects/from-recipient";

/**
 * A reader gave their email on a shared link: their own link, a deal like any
 * other (score, alerts, accept, follow-ups). It starts from the shared link's
 * settings and is reused when they come back. Their follow-ups always wait
 * for the seller: the address was typed, not given by the seller.
 */
export async function readerLinkFor(
  parent: {
    id: string;
    documentId: string;
    organizationId: string;
    createdById: string | null;
    ctaEnabled: boolean;
    chatEnabled: boolean;
    voiceCommentsEnabled: boolean;
    followupsEnabled: boolean;
    expiresAt: Date | null;
  },
  email: string,
  name?: string | null,
) {
  const existing = await prisma.link.findFirst({
    where: { parentLinkId: parent.id, archivedAt: null, prospects: { some: { email } } },
    select: { id: true, slug: true },
  });
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
