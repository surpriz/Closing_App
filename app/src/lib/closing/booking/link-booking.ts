import { prisma } from "@/lib/db";

import { resolveRecipient } from "../notify/preferences";

/** Booking page set by the seller who created the link (the workspace owner for older links). */
export async function sellerBookingUrl(link: { createdById: string | null; organizationId: string }) {
  const seller = await resolveRecipient(link);
  if (!seller) return null;
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId_organizationId: { userId: seller.id, organizationId: link.organizationId } },
    select: { bookingUrl: true },
  });
  return prefs?.bookingUrl ?? null;
}

/** Booking page offered on a link: its own, otherwise the seller's. Null = no button. */
export async function bookingUrlForLink(link: {
  bookingUrl: string | null;
  createdById: string | null;
  organizationId: string;
}) {
  return link.bookingUrl ?? (await sellerBookingUrl(link));
}
