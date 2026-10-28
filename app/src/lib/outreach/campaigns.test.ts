import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  campaign: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  campaignStep: { upsert: vi.fn((arg: unknown) => ({ upsert: arg })), deleteMany: vi.fn((arg: unknown) => ({ deleteMany: arg })) },
  campaignProspect: { findFirst: vi.fn(), updateMany: vi.fn((arg: unknown) => ({ pros: arg })) },
  campaignMessage: { updateMany: vi.fn((arg: unknown) => ({ msg: arg })) },
  mailbox: { findFirst: vi.fn() },
  document: { findFirst: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
};
vi.mock("@/lib/db", () => ({ prisma: db }));

const { activateCampaign, archiveCampaign, finishIdleCampaigns, saveSteps, updateCampaign } = await import("./campaigns");

const NOW = new Date("2026-11-03T09:00:00Z");
const goodStep = { order: 1, delayDays: 0, subject: "Hi", newThread: false, body: "Hello", carriesLink: false };

function campaign(over: Record<string, unknown> = {}) {
  return {
    startedAt: null,
    documentId: null,
    linkOnReply: false,
    mailbox: { status: "ACTIVE" },
    steps: [goodStep],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.campaign.updateMany.mockResolvedValue({ count: 1 });
});

describe("activateCampaign", () => {
  it("refuses an unknown or already running campaign", async () => {
    db.campaign.findFirst.mockResolvedValue(null);
    expect(await activateCampaign("org", "c1", NOW)).toEqual({ ok: false, issue: "not_found" });
  });

  it("needs a mailbox, and an ACTIVE one", async () => {
    db.campaign.findFirst.mockResolvedValueOnce(campaign({ mailbox: null }));
    expect(await activateCampaign("org", "c1", NOW)).toEqual({ ok: false, issue: "no_mailbox" });
    db.campaign.findFirst.mockResolvedValueOnce(campaign({ mailbox: { status: "ERROR" } }));
    expect(await activateCampaign("org", "c1", NOW)).toEqual({ ok: false, issue: "mailbox_not_active" });
  });

  it("returns the step issues", async () => {
    db.campaign.findFirst.mockResolvedValue(campaign({ steps: [{ ...goodStep, body: "" }] }));
    expect(await activateCampaign("org", "c1", NOW)).toEqual({
      ok: false,
      issue: "steps",
      steps: [{ code: "empty_body", order: 1 }],
    });
  });

  it("needs a document when a step carries the link, or the link goes out on reply", async () => {
    db.campaign.findFirst.mockResolvedValueOnce(
      campaign({ steps: [{ ...goodStep, carriesLink: true, body: "{{link}}" }] }),
    );
    expect(await activateCampaign("org", "c1", NOW)).toEqual({ ok: false, issue: "document_required" });
    db.campaign.findFirst.mockResolvedValueOnce(campaign({ linkOnReply: true }));
    expect(await activateCampaign("org", "c1", NOW)).toEqual({ ok: false, issue: "document_required" });
  });

  it("needs someone to write to", async () => {
    db.campaign.findFirst.mockResolvedValue(campaign());
    db.campaignProspect.findFirst.mockResolvedValue(null);
    expect(await activateCampaign("org", "c1", NOW)).toEqual({ ok: false, issue: "no_enrollment" });
    expect(db.campaignProspect.findFirst.mock.calls[0][0].where).toEqual({
      campaignId: "c1",
      status: { in: ["QUEUED", "ACTIVE", "PAUSED"] },
    });
  });

  it("starts the campaign and keeps the first start date", async () => {
    const started = new Date("2026-10-01T00:00:00Z");
    db.campaign.findFirst.mockResolvedValue(campaign({ startedAt: started }));
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1" });
    expect(await activateCampaign("org", "c1", NOW)).toEqual({ ok: true });
    expect(db.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: "org", status: { in: ["DRAFT", "PAUSED"] } },
      data: { status: "ACTIVE", startedAt: started, pausedAt: null },
    });
  });
});

describe("archiveCampaign", () => {
  it("cancels what is pending and stops the enrollments still running", async () => {
    expect(await archiveCampaign("org", "c1", NOW)).toBe(true);
    expect(db.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: "org", status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", archivedAt: NOW },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: { in: ["SCHEDULED", "SENDING"] } },
      data: { status: "CANCELLED" },
    });
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: { in: ["QUEUED", "ACTIVE", "PAUSED"] } },
      data: { status: "STOPPED", finishedAt: NOW, pausedReason: "archived" },
    });
  });

  it("does nothing on a campaign already archived", async () => {
    db.campaign.updateMany.mockResolvedValue({ count: 0 });
    expect(await archiveCampaign("org", "c1", NOW)).toBe(false);
    expect(db.campaignMessage.updateMany).not.toHaveBeenCalled();
  });
});

describe("finishIdleCampaigns", () => {
  it("finishes the ACTIVE campaigns nobody is in anymore", async () => {
    db.campaign.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    expect(await finishIdleCampaigns(NOW, { organizationId: "org" })).toBe(1);
    expect(db.campaign.findMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      organizationId: "org",
      enrollments: { some: {}, none: { status: { in: ["QUEUED", "ACTIVE", "PAUSED"] } } },
      messages: { none: { status: { in: ["SCHEDULED", "SENDING"] } } },
    });
    expect(db.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2"] }, status: "ACTIVE" },
      data: { status: "DONE", finishedAt: NOW },
    });
  });

  it("skips the update when nothing is idle", async () => {
    db.campaign.findMany.mockResolvedValue([]);
    expect(await finishIdleCampaigns(NOW)).toBe(0);
    expect(db.campaign.updateMany).not.toHaveBeenCalled();
  });
});

describe("updateCampaign", () => {
  it("only accepts an ACTIVE mailbox of the workspace", async () => {
    db.mailbox.findFirst.mockResolvedValue(null);
    expect(await updateCampaign("org", "c1", { mailboxId: "m1" })).toBe(false);
    expect(db.mailbox.findFirst.mock.calls[0][0].where).toEqual({ id: "m1", organizationId: "org", status: "ACTIVE" });
    expect(db.campaign.updateMany).not.toHaveBeenCalled();
  });

  it("only accepts a READY, non-archived document of the workspace", async () => {
    db.document.findFirst.mockResolvedValue(null);
    expect(await updateCampaign("org", "c1", { documentId: "d1" })).toBe(false);
    expect(db.document.findFirst.mock.calls[0][0].where).toEqual({
      id: "d1",
      organizationId: "org",
      status: "READY",
      archivedAt: null,
    });
  });

  it("rejects an unsupported locale", async () => {
    expect(await updateCampaign("org", "c1", { locale: "de" })).toBe(false);
  });
});

describe("saveSteps", () => {
  it("writes nothing when the sequence is invalid", async () => {
    const result = await saveSteps("org", "c1", []);
    expect(result).toEqual({ ok: false, issues: [{ code: "no_steps" }] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("upserts by order and drops the surplus", async () => {
    db.campaign.findFirst.mockResolvedValue({ id: "c1" });
    expect(await saveSteps("org", "c1", [goodStep])).toEqual({ ok: true });
    expect((db.campaignStep.upsert.mock.calls[0][0] as { where: unknown }).where).toEqual({ campaignId_order: { campaignId: "c1", order: 1 } });
    expect(db.campaignStep.deleteMany).toHaveBeenCalledWith({ where: { campaignId: "c1", order: { gt: 1 } } });
  });
});
