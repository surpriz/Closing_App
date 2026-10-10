import { DEAL_STATUS_LABELS } from "@/components/dashboard/labels";
import type { DealStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { refreshEngagementScore } from "../engagement/refresh-score";
import { cancelOpenFollowups } from "../followups/queue";

/** The seller moves a deal: dated when it closes, automated follow-ups stop once it is no longer open. */
export async function applyDealStatus(linkId: string, dealStatus: DealStatus) {
  await prisma.link.update({
    where: { id: linkId },
    data: { dealStatus, closedAt: dealStatus === "OPEN" ? null : new Date() },
  });
  if (dealStatus !== "OPEN") {
    await cancelOpenFollowups(linkId, `Statut passé à « ${DEAL_STATUS_LABELS[dealStatus]} »`);
  }
  await refreshEngagementScore(linkId);
}
