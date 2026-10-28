import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  followup: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  documentView: { count: vi.fn() },
}));
const mocks = vi.hoisted(() => ({ sendCampaignFollowup: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/outreach/followup-transport", () => ({ sendCampaignFollowup: mocks.sendCampaignFollowup }));
vi.mock("@/lib/email", () => ({ isEmailConfigured: () => false }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));
vi.mock("@/lib/closing/active-workspace", () => ({ ACTIVE_WORKSPACE: {} }));
vi.mock("../channels/whatsapp", () => ({ isWhatsAppConfigured: () => false, sendWhatsApp: vi.fn() }));
vi.mock("../replies/inbound", () => ({ replyRelayAddress: () => "r@x" }));
vi.mock("../prospect-email", () => ({ sendProspectEmail: vi.fn() }));

const { sendFollowup } = await import("./dispatch");

function row(over: { link?: object; [k: string]: unknown } = {}) {
  const { link, ...rest } = over;
  return {
    id: "f1",
    status: "GENERATED",
    body: "Hello",
    subject: "Hi",
    channel: "EMAIL",
    trigger: "COLD_READ",
    locale: "en",
    approvedAt: null,
    createdAt: new Date(),
    campaignProspectId: null,
    prospect: { unsubscribedAt: null, bouncedAt: null, company: "Acme" },
    link: {
      slug: "abc123xyz",
      archivedAt: null,
      followupsEnabled: true,
      dealStatus: "OPEN",
      snoozedUntil: null,
      meetingBookedAt: null,
      repliedAt: null,
      quoteRequestedAt: null,
      expiresAt: null,
      campaignOwned: true,
      createdBy: { email: "s@x", locale: "en" },
      document: { name: "Quote", displayTitle: null, docType: null },
      ...link,
    },
    ...rest,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.followup.update.mockResolvedValue({});
});

describe("sendFollowup, campaign links", () => {
  it("hands a campaign follow-up to the mailbox transport, before any claim", async () => {
    db.followup.findUnique.mockResolvedValue(row({ campaignProspectId: "e1" }));
    mocks.sendCampaignFollowup.mockResolvedValue("sent");
    expect(await sendFollowup("f1")).toBe("sent");
    expect(mocks.sendCampaignFollowup).toHaveBeenCalledWith("f1", expect.any(Date), { approvedById: undefined });
    expect(db.followup.updateMany).not.toHaveBeenCalled();
  });

  it("still applies the common re-checks (replied) to a campaign follow-up", async () => {
    db.followup.findUnique.mockResolvedValue(row({ campaignProspectId: "e1", link: { repliedAt: new Date() } }));
    expect(await sendFollowup("f1")).toBe("cancelled");
    expect(mocks.sendCampaignFollowup).not.toHaveBeenCalled();
  });

  it("cancels a follow-up without campaignProspectId on a campaign-owned link", async () => {
    db.followup.findUnique.mockResolvedValue(row());
    expect(await sendFollowup("f1")).toBe("cancelled");
    expect(db.followup.update.mock.calls[0][0].data).toMatchObject({
      status: "CANCELLED",
      error: "Follow-ups are driven by the campaign",
    });
    expect(mocks.sendCampaignFollowup).not.toHaveBeenCalled();
  });

  it("maps a rescheduled campaign follow-up to ignored", async () => {
    db.followup.findUnique.mockResolvedValue(row({ campaignProspectId: "e1" }));
    mocks.sendCampaignFollowup.mockResolvedValue("rescheduled");
    expect(await sendFollowup("f1")).toBe("ignored");
  });
});
