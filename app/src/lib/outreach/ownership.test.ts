import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: { link: { updateMany } } }));

import { isCampaignOwned, NOT_CAMPAIGN_OWNED, releaseCampaignLink } from "./ownership";

describe("campaign link ownership", () => {
  beforeEach(() => updateMany.mockReset());

  it("exposes the where-fragment and the predicate", () => {
    expect(NOT_CAMPAIGN_OWNED).toEqual({ campaignOwned: false });
    expect(isCampaignOwned({ campaignOwned: true })).toBe(true);
    expect(isCampaignOwned({ campaignOwned: false })).toBe(false);
  });

  it("releases only a link still owned and turns follow-ups off", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(releaseCampaignLink("link-1")).resolves.toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "link-1", campaignOwned: true },
      data: { campaignOwned: false, followupsEnabled: false },
    });
  });

  it("returns 0 when the link was not owned", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(releaseCampaignLink("link-2")).resolves.toBe(0);
  });
});
