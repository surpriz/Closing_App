import { prisma } from "@/lib/db";

/**
 * Campaign links carry ?c=<message id>: the first opening that comes from a message is credited to it. The id only
 * counts on the enrollment that owns the link, so a pasted one proves nothing.
 */

/** True when this call was the one that credited the click. */
export async function claimCampaignClick(messageId: string | null | undefined, enrollmentId: string | null, now: Date) {
  if (!messageId || !enrollmentId) return false;
  const { count } = await prisma.campaignMessage.updateMany({
    where: { id: messageId, enrollmentId, clickedAt: null },
    data: { clickedAt: now },
  });
  return count > 0;
}

/**
 * A campaign link has no gate, so its readers are anonymous. When the link has exactly one prospect of origin
 * CAMPAIGN (the enrolled address), the reading is theirs.
 */
export async function campaignProspectFor(link: { id: string; campaignProspectId: string | null }) {
  if (!link.campaignProspectId) return null;
  const prospects = await prisma.prospect.findMany({
    where: { linkId: link.id, origin: "CAMPAIGN" },
    select: { id: true },
    take: 2,
  });
  return prospects.length === 1 ? prospects[0].id : null;
}
