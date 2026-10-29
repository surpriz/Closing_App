import { beforeEach, describe, expect, it, vi } from "vitest";

const viewFind = vi.fn();
const alertFind = vi.fn();
const prospectFind = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    documentView: { findUnique: (...a: unknown[]) => viewFind(...a) },
    sellerAlert: { findUnique: (...a: unknown[]) => alertFind(...a) },
    prospect: { findFirst: (...a: unknown[]) => prospectFind(...a) },
  },
}));
const queueFollowup = vi.fn();
vi.mock("../followups/queue", () => ({
  queueFollowup: (...a: unknown[]) => queueFollowup(...a),
  generateFollowupMessage: vi.fn(),
}));

const { evaluateHotLead, evaluatePricingCallMoment } = await import("./hot-lead");
const { queueInterestFollowup } = await import("./interest-returned");

const now = new Date("2026-10-07T08:00:00Z");

beforeEach(() => vi.clearAllMocks());

describe("links a campaign owns", () => {
  it("evaluateHotLead raises no call moment", async () => {
    viewFind.mockResolvedValue({
      id: "v1",
      linkId: "l1",
      isBot: false,
      link: { organizationId: "o1", dealStatus: "OPEN", archivedAt: null, shared: false, parentLinkId: null, campaignOwned: true },
    });
    await evaluateHotLead("v1", false, now);
    expect(alertFind).not.toHaveBeenCalled();
  });

  it("evaluateHotLead still looks at an ordinary link", async () => {
    viewFind.mockResolvedValue({
      id: "v1",
      linkId: "l1",
      isBot: false,
      link: { organizationId: "o1", dealStatus: "OPEN", archivedAt: null, shared: false, parentLinkId: null, campaignOwned: false },
    });
    alertFind.mockResolvedValue({ id: "a1" });
    await evaluateHotLead("v1", false, now);
    expect(alertFind).toHaveBeenCalled();
  });

  it("evaluatePricingCallMoment raises no call moment", async () => {
    viewFind.mockResolvedValue({
      id: "v1",
      linkId: "l1",
      isBot: false,
      leftAt: null,
      link: {
        organizationId: "o1",
        dealStatus: "OPEN",
        archivedAt: null,
        shared: false,
        campaignOwned: true,
        hotPricingThresholdSec: null,
        document: { pages: [{ pageNumber: 2 }] },
      },
    });
    await evaluatePricingCallMoment("v1", now);
    expect(alertFind).not.toHaveBeenCalled();
  });

  it("queueInterestFollowup queues nothing", async () => {
    prospectFind.mockResolvedValue({
      id: "p1",
      locale: "fr",
      timezone: null,
      link: { campaignOwned: true, createdBy: { locale: "fr" } },
    });
    await queueInterestFollowup("l1", "p1", { kind: "expired", since: now } as never, now);
    expect(queueFollowup).not.toHaveBeenCalled();
  });
});
