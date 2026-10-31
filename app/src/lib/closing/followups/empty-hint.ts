export type FollowupsEmptyHint = "emptyHintCampaign" | "emptyHintOff" | "emptyHintShared" | "emptyHintNoEmail";

/**
 * Why a link has no follow-up yet, as a `deal.followupsPanel.*` key; null keeps the default hint.
 * A campaign drives the link; the seller switched follow-ups off; a Smart Link's readers each get
 * their own link (and their own follow-ups); a personal link has nobody to write to yet.
 */
export function followupsEmptyHint(link: {
  campaign: string | null;
  followupsEnabled: boolean;
  shared: boolean;
  hasEmail: boolean;
}): FollowupsEmptyHint | null {
  if (link.campaign) return "emptyHintCampaign";
  if (!link.followupsEnabled) return "emptyHintOff";
  if (link.shared) return "emptyHintShared";
  if (!link.hasEmail) return "emptyHintNoEmail";
  return null;
}
