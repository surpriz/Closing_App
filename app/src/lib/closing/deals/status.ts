import type { DealStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { toUiLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { refreshEngagementScore } from "../engagement/refresh-score";
import { cancelOpenFollowups } from "../followups/queue";

/** The seller moves a deal: dated when it closes, automated follow-ups stop once it is no longer open. */
export async function applyDealStatus(linkId: string, dealStatus: DealStatus) {
  const link = await prisma.link.update({
    where: { id: linkId },
    data: { dealStatus, closedAt: dealStatus === "OPEN" ? null : new Date() },
    select: { createdBy: { select: { locale: true } } },
  });
  if (dealStatus !== "OPEN") {
    // The reason shows on the cancelled follow-ups, for the seller
    const locale = toUiLocale(link.createdBy?.locale);
    const status = getNamespaceTranslator(locale, "labels")(`dealStatus.${dealStatus}`);
    await cancelOpenFollowups(linkId, getNamespaceTranslator(locale, "server.followups")("statusChanged", { status }));
  }
  await refreshEngagementScore(linkId);
}
