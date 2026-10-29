import { prisma } from "@/lib/db";

/** Where-fragment for link scans of the closing engine: links a campaign still drives are not theirs to follow up. */
export const NOT_CAMPAIGN_OWNED = { campaignOwned: false } as const;

export function isCampaignOwned(link: { campaignOwned: boolean }) {
  return link.campaignOwned;
}

/** The campaign is done with this prospect (reply, finish, stop): the link becomes an ordinary deal, follow-ups off. */
export async function releaseCampaignLink(linkId: string) {
  const { count } = await prisma.link.updateMany({
    where: { id: linkId, campaignOwned: true },
    data: { campaignOwned: false, followupsEnabled: false },
  });
  return count;
}
