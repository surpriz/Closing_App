import type { FollowupChannel, ProspectOrigin } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

import { companyFromEmail } from "../prospects/from-recipient";
import { isWorkspaceAddress } from "./seller-address";

/**
 * A reader gave their email on a shared link: their own link, a deal like any
 * other (score, alerts, accept, follow-ups). It starts from the shared link's
 * settings. Their follow-ups always wait for the seller: the address was
 * typed, not given by the seller.
 *
 * An existing link is reused only from a browser that already read it: typing
 * someone else's address must not open their link (a message recorded for
 * them, their signature). Elsewhere the reader gets a new link.
 *
 * A Smart Link reader comes with the address and company the cold email tool
 * put in the URL: unverified too, so the same rules.
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
    translationEnabled: boolean;
    forwardEnabled: boolean;
    followupsEnabled: boolean;
    expiresAt: Date | null;
    hotPricingThresholdSec: number | null;
    channels: FollowupChannel[];
    inactivityDays: number[];
    businessHourStart: number | null;
    businessHourEnd: number | null;
  },
  email: string,
  visitorId: string | null | undefined,
  name?: string | null,
  from: { origin?: ProspectOrigin; company?: string | null } = {},
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

  const company = from.company ?? companyFromEmail(email);
  // The seller trying their own link (their address, "+test" or not): a test, out of every count
  const test = await isWorkspaceAddress(parent.organizationId, email);
  // A first real reader came through it: the shared link has gone out, it no longer waits to be sent
  if (!test) {
    await prisma.link.updateMany({ where: { id: parent.id, draftAt: { not: null } }, data: { draftAt: null, sentAt: new Date() } });
  }
  return prisma.link.create({
    data: {
      slug: randomSlug(12),
      documentId: parent.documentId,
      organizationId: parent.organizationId,
      createdById: parent.createdById,
      parentLinkId: parent.id,
      isOnboardingTest: test,
      name: company ?? name ?? email,
      // They just gave their email: the gate is behind them
      requireEmail: true,
      ctaEnabled: parent.ctaEnabled,
      bookingEnabled: parent.bookingEnabled,
      bookingUrl: parent.bookingUrl,
      chatEnabled: parent.chatEnabled,
      voiceCommentsEnabled: parent.voiceCommentsEnabled,
      translationEnabled: parent.translationEnabled,
      forwardEnabled: parent.forwardEnabled,
      followupsEnabled: parent.followupsEnabled,
      hotPricingThresholdSec: parent.hotPricingThresholdSec,
      channels: parent.channels,
      inactivityDays: parent.inactivityDays,
      businessHourStart: parent.businessHourStart,
      businessHourEnd: parent.businessHourEnd,
      expiresAt: parent.expiresAt,
      sentAt: new Date(),
      prospects: { create: { email, name: name || null, company, origin: from.origin ?? "EMAIL_GATE" } },
    },
    select: { id: true, slug: true },
  });
}
