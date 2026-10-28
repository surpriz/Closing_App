/** Where a campaign-owned link stands in its sequence, for the dashboard rows and the deal header. */
export const linkCampaignSelect = {
  campaignOwned: true,
  campaignProspect: {
    select: {
      currentStep: true,
      campaign: { select: { id: true, name: true, _count: { select: { steps: true } } } },
    },
  },
} as const;

type LinkCampaignRow = {
  campaignOwned: boolean;
  campaignProspect: {
    currentStep: number;
    campaign: { id: string; name: string; _count: { steps: number } };
  } | null;
};

/** The campaign driving the link, only while it still owns it. */
export function linkCampaign(link: LinkCampaignRow) {
  if (!link.campaignOwned || !link.campaignProspect) return null;
  const { currentStep, campaign } = link.campaignProspect;
  return { id: campaign.id, name: campaign.name, step: currentStep, steps: campaign._count.steps };
}
