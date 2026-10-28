import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFind = vi.fn();
const enrollmentUpdateMany = vi.fn();
const linkFind = vi.fn();
const linkUpdate = vi.fn();
const prospectFind = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    campaignProspect: {
      findUnique: (...a: unknown[]) => enrollmentFind(...a),
      updateMany: (...a: unknown[]) => enrollmentUpdateMany(...a),
    },
    link: { findUnique: (...a: unknown[]) => linkFind(...a), update: (...a: unknown[]) => linkUpdate(...a) },
    prospect: { findFirst: (...a: unknown[]) => prospectFind(...a) },
  },
}));
const createDocumentLink = vi.fn();
vi.mock("@/lib/closing/documents/create-link", () => ({ createDocumentLink: (...a: unknown[]) => createDocumentLink(...a) }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.example.com" }));

const { campaignMessageUrl, createCampaignLink } = await import("./link");

const base = {
  email: "paul@acme.com",
  firstName: "Paul",
  lastName: "Martin",
  company: "Acme",
  linkId: null as string | null,
  prospectId: null as string | null,
  campaign: { organizationId: "org", createdById: "user", documentId: "doc" as string | null },
};
const now = new Date("2026-11-20T12:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  enrollmentFind.mockResolvedValue(base);
  prospectFind.mockResolvedValue({ id: "pr1" });
  createDocumentLink.mockResolvedValue({ id: "l1", slug: "abcdef123456", title: "Devis – Acme", path: "/v/acme-abcdef123456" });
  enrollmentUpdateMany.mockResolvedValue({ count: 1 });
});

describe("createCampaignLink", () => {
  it("reuses the link already attached to the enrollment", async () => {
    enrollmentFind.mockResolvedValue({ ...base, linkId: "l0", prospectId: "pr0" });
    linkFind.mockResolvedValue({ slug: "zzzzzz111111", document: { name: "quote.pdf", displayTitle: "Devis", docType: null }, prospects: [] });
    const link = await createCampaignLink("e1", { owned: true, now });
    expect(createDocumentLink).not.toHaveBeenCalled();
    expect(link).toEqual({
      linkId: "l0",
      prospectId: "pr0",
      url: "https://app.example.com/v/acme-devis-zzzzzz111111",
      title: "Devis – Acme",
    });
  });

  it("returns null without a document", async () => {
    enrollmentFind.mockResolvedValue({ ...base, campaign: { ...base.campaign, documentId: null } });
    expect(await createCampaignLink("e1", { owned: true, now })).toBeNull();
    expect(createDocumentLink).not.toHaveBeenCalled();
  });

  it("returns null when the document is gone", async () => {
    createDocumentLink.mockResolvedValue(null);
    expect(await createCampaignLink("e1", { owned: true, now })).toBeNull();
    expect(linkUpdate).not.toHaveBeenCalled();
  });

  it.each([true, false])("creates the link with campaignOwned=%s", async (owned) => {
    const link = await createCampaignLink("e1", { owned, now });
    expect(createDocumentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user",
        prospect: { email: "paul@acme.com", name: "Paul Martin", company: "Acme", origin: "CAMPAIGN" },
        requireEmail: false,
        expiresAt: null,
        followupsEnabled: false,
        source: "campaign",
      }),
    );
    expect(linkUpdate).toHaveBeenCalledWith({ where: { id: "l1" }, data: { campaignProspectId: "e1", campaignOwned: owned } });
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", linkId: null },
      data: { linkId: "l1", prospectId: "pr1" },
    });
    expect(link).toEqual({ linkId: "l1", prospectId: "pr1", url: "https://app.example.com/v/acme-abcdef123456", title: "Devis – Acme" });
  });

  it("archives its own link when another pass attached one first", async () => {
    enrollmentUpdateMany.mockResolvedValue({ count: 0 });
    enrollmentFind.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, linkId: "winner", prospectId: "prw" });
    linkFind.mockResolvedValue({ slug: "wwwwww111111", document: { name: "q", displayTitle: "Devis", docType: null }, prospects: [] });
    const link = await createCampaignLink("e1", { owned: true, now });
    expect(linkUpdate).toHaveBeenLastCalledWith({ where: { id: "l1" }, data: { archivedAt: now } });
    expect(link?.linkId).toBe("winner");
  });

  it("archives the fresh link and rethrows when a step after creation fails", async () => {
    prospectFind.mockRejectedValue(new Error("db down"));
    await expect(createCampaignLink("e1", { owned: true, now })).rejects.toThrow("db down");
    expect(linkUpdate).toHaveBeenLastCalledWith({ where: { id: "l1" }, data: { archivedAt: now } });
  });

  it("still returns the winner's link when archiving the loser fails", async () => {
    enrollmentUpdateMany.mockResolvedValue({ count: 0 });
    enrollmentFind.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, linkId: "winner" });
    linkUpdate.mockImplementation(async (arg: { data: { archivedAt?: Date } }) => {
      if (arg.data.archivedAt) throw new Error("boom");
    });
    linkFind.mockResolvedValue({ slug: "wwwwww111111", document: { name: "q", displayTitle: "Devis", docType: null }, prospects: [] });
    expect((await createCampaignLink("e1", { owned: true, now }))?.linkId).toBe("winner");
  });
});

describe("campaignMessageUrl", () => {
  it("adds the message id as ?c=", () => {
    expect(campaignMessageUrl("https://app.example.com/v/acme-abc", "m1")).toBe("https://app.example.com/v/acme-abc?c=m1");
  });
  it("appends with & when the url already has a query", () => {
    expect(campaignMessageUrl("https://app.example.com/v/x?a=1", "m1")).toBe("https://app.example.com/v/x?a=1&c=m1");
  });
});
