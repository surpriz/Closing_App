import { beforeEach, describe, expect, it, vi } from "vitest";

const messageUpdateMany = vi.fn();
const prospectFindMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    campaignMessage: { updateMany: (...a: unknown[]) => messageUpdateMany(...a) },
    prospect: { findMany: (...a: unknown[]) => prospectFindMany(...a) },
  },
}));

const { campaignProspectFor, claimCampaignClick } = await import("./attribution");
const now = new Date("2026-11-18T10:00:00Z");

beforeEach(() => vi.resetAllMocks());

describe("claimCampaignClick", () => {
  it("credits the first opening, only on the enrollment's own message", async () => {
    messageUpdateMany.mockResolvedValue({ count: 1 });
    expect(await claimCampaignClick("m1", "e1", now)).toBe(true);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", enrollmentId: "e1", clickedAt: null },
      data: { clickedAt: now },
    });
  });
  it("reports a click already credited, and ignores a missing id or a link without enrollment", async () => {
    messageUpdateMany.mockResolvedValue({ count: 0 });
    expect(await claimCampaignClick("m1", "e1", now)).toBe(false);
    messageUpdateMany.mockClear();
    expect(await claimCampaignClick(null, "e1", now)).toBe(false);
    expect(await claimCampaignClick("m1", null, now)).toBe(false);
    expect(messageUpdateMany).not.toHaveBeenCalled();
  });
});

describe("campaignProspectFor", () => {
  it("is the enrolled prospect when the link has exactly one of origin CAMPAIGN", async () => {
    prospectFindMany.mockResolvedValue([{ id: "p1" }]);
    expect(await campaignProspectFor({ id: "l1", campaignProspectId: "e1" })).toBe("p1");
    expect(prospectFindMany).toHaveBeenCalledWith({ where: { linkId: "l1", origin: "CAMPAIGN" }, select: { id: true }, take: 2 });
  });
  it("is null with several, with none, or on a link no campaign owns", async () => {
    prospectFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    expect(await campaignProspectFor({ id: "l1", campaignProspectId: "e1" })).toBeNull();
    prospectFindMany.mockResolvedValue([]);
    expect(await campaignProspectFor({ id: "l1", campaignProspectId: "e1" })).toBeNull();
    prospectFindMany.mockClear();
    expect(await campaignProspectFor({ id: "l1", campaignProspectId: null })).toBeNull();
    expect(prospectFindMany).not.toHaveBeenCalled();
  });
});
