import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  campaign: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  campaignStep: { upsert: vi.fn((arg: unknown) => ({ upsert: arg })), deleteMany: vi.fn((arg: unknown) => ({ deleteMany: arg })) },
  campaignProspect: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
  campaignMessage: { updateMany: vi.fn(async () => ({ count: 1 })) },
  mailbox: { findFirst: vi.fn() },
  document: { findFirst: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};
vi.mock("@/lib/db", () => ({ prisma: db }));

const { activateCampaign, archiveCampaign, createCampaign, finishIdleCampaigns, pauseCampaign, pauseCampaignsOfMailbox, saveSteps, updateCampaign, canEditCampaign } = await import("./campaigns");

const NOW = new Date("2026-11-03T09:00:00Z");
const ACTOR = { userId: "u1", isManager: false };
const STRANGER = { userId: "u2", isManager: false };
const MANAGER = { userId: "u3", isManager: true };
const goodStep = { order: 1, delayDays: 0, subject: "Hi", newThread: false, body: "Hello", carriesLink: false };

function campaign(over: Record<string, unknown> = {}) {
  return {
    createdById: "u1",
    startedAt: null,
    documentId: null,
    linkOnReply: false,
    mailbox: { status: "ACTIVE", organizationId: "org" },
    steps: [goodStep],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.campaign.updateMany.mockResolvedValue({ count: 1 });
  db.campaignProspect.findMany.mockResolvedValue([]);
});

describe("activateCampaign", () => {
  it("refuses an unknown or already running campaign", async () => {
    db.campaign.findFirst.mockResolvedValue(null);
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: false, issue: "not_found" });
  });

  it("needs a mailbox, and an ACTIVE one", async () => {
    db.campaign.findFirst.mockResolvedValueOnce(campaign({ mailbox: null }));
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: false, issue: "no_mailbox" });
    db.campaign.findFirst.mockResolvedValueOnce(campaign({ mailbox: { status: "ERROR", organizationId: "org" } }));
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: false, issue: "mailbox_not_active" });
  });

  it("returns the step issues", async () => {
    db.campaign.findFirst.mockResolvedValue(campaign({ steps: [{ ...goodStep, body: "" }] }));
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({
      ok: false,
      issue: "steps",
      steps: [{ code: "empty_body", order: 1 }],
    });
  });

  it("needs a document when a step carries the link, or the link goes out on reply", async () => {
    db.campaign.findFirst.mockResolvedValueOnce(
      campaign({ steps: [{ ...goodStep, carriesLink: true, body: "{{link}}" }] }),
    );
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: false, issue: "document_required" });
    db.campaign.findFirst.mockResolvedValueOnce(campaign({ linkOnReply: true }));
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: false, issue: "document_required" });
  });

  it("refuses a campaign a teammate created, unless the actor manages the workspace", async () => {
    db.campaign.findFirst.mockResolvedValue(campaign({ createdById: "u9" }));
    expect(await activateCampaign("org", "c1", STRANGER, NOW)).toEqual({ ok: false, issue: "not_found" });
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1" });
    expect(await activateCampaign("org", "c1", MANAGER, NOW)).toEqual({ ok: true });
  });

  it("refuses a mailbox from another workspace", async () => {
    db.campaign.findFirst.mockResolvedValue(campaign({ mailbox: { status: "ACTIVE", organizationId: "other" } }));
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: false, issue: "no_mailbox" });
  });

  it("restarts a DONE campaign and clears its finish date", async () => {
    db.campaign.findFirst.mockResolvedValue(campaign({ startedAt: NOW }));
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1" });
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: true });
    expect(db.campaign.findFirst.mock.calls[0][0].where.status).toEqual({ in: ["DRAFT", "PAUSED", "DONE"] });
    expect(db.campaign.updateMany.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", finishedAt: null });
  });

  it("needs someone to write to", async () => {
    db.campaign.findFirst.mockResolvedValue(campaign());
    db.campaignProspect.findFirst.mockResolvedValue(null);
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: false, issue: "no_enrollment" });
    expect(db.campaignProspect.findFirst.mock.calls[0][0].where).toEqual({
      campaignId: "c1",
      status: { in: ["QUEUED", "ACTIVE", "PAUSED"] },
    });
  });

  it("refuses a variable without fallback that neither a built-in nor an imported column fills", async () => {
    const steps = [{ ...goodStep, body: "Hi {{firstName}}, about {{project}} and {{budget|your budget}} in {{city}}" }];
    db.campaign.findFirst.mockResolvedValue(campaign({ steps }));
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1" });
    db.campaignProspect.findMany.mockResolvedValue([{ vars: { City: "Lyon" } }, { vars: null }]);
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({
      ok: false,
      issue: "unknown_variables",
      variables: ["project"],
    });
    expect(db.campaignProspect.findMany.mock.calls[0][0]).toEqual({
      where: { campaignId: "c1", status: { in: ["QUEUED", "ACTIVE", "PAUSED"] } },
      select: { vars: true },
    });
    expect(db.campaign.updateMany).not.toHaveBeenCalled();

    db.campaignProspect.findMany.mockResolvedValue([{ vars: { project: "CRM" } }, { vars: { city: "Paris" } }]);
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: true });
  });

  it("starts the campaign and keeps the first start date", async () => {
    const started = new Date("2026-10-01T00:00:00Z");
    db.campaign.findFirst.mockResolvedValue(campaign({ startedAt: started }));
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1" });
    expect(await activateCampaign("org", "c1", ACTOR, NOW)).toEqual({ ok: true });
    expect(db.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: "org", status: { in: ["DRAFT", "PAUSED", "DONE"] } },
      data: { status: "ACTIVE", startedAt: started, pausedAt: null, finishedAt: null },
    });
  });
});

describe("archiveCampaign", () => {
  beforeEach(() => db.campaign.findFirst.mockResolvedValue({ createdById: "u1", mailboxId: null }));

  it("cancels what is pending and stops the enrollments still running", async () => {
    expect(await archiveCampaign("org", "c1", ACTOR, NOW)).toBe(true);
    expect(db.campaign.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: "org", status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED", archivedAt: NOW },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", campaign: { organizationId: "org" }, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", organizationId: "org", status: { in: ["QUEUED", "ACTIVE", "PAUSED"] } },
      data: { status: "STOPPED", finishedAt: NOW, pausedReason: "archived" },
    });
  });

  it("flips the status last, in the same transaction, so a failure can be retried", async () => {
    const order: string[] = [];
    db.campaignMessage.updateMany.mockImplementationOnce(async () => (order.push("messages"), { count: 1 }));
    db.campaignProspect.updateMany.mockImplementationOnce(async () => (order.push("enrollments"), { count: 1 }));
    db.campaign.updateMany.mockImplementationOnce(async () => (order.push("status"), { count: 1 }));
    await archiveCampaign("org", "c1", ACTOR, NOW);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["messages", "enrollments", "status"]);
  });

  it("touches nothing for someone who did not create the campaign, unless they manage the workspace", async () => {
    expect(await archiveCampaign("org", "c1", STRANGER, NOW)).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(await archiveCampaign("org", "c1", MANAGER, NOW)).toBe(true);
  });

  it("reports false on a campaign already archived", async () => {
    db.campaign.updateMany.mockResolvedValue({ count: 0 });
    expect(await archiveCampaign("org", "c1", ACTOR, NOW)).toBe(false);
  });
});

describe("finishIdleCampaigns", () => {
  it("finishes ACTIVE campaigns nobody is in anymore, rechecking the conditions in the update", async () => {
    expect(await finishIdleCampaigns(NOW, { organizationId: "org" })).toBe(1);
    expect(db.campaign.updateMany).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
        organizationId: "org",
        enrollments: { some: {}, none: { status: { in: ["QUEUED", "ACTIVE", "PAUSED"] } } },
      },
      data: { status: "DONE", finishedAt: NOW },
    });
  });

  it("restricts to the beta workspaces", async () => {
    await finishIdleCampaigns(NOW, { organizationIds: ["org", "org2"] });
    expect(db.campaign.updateMany.mock.calls[0][0].where.organizationId).toEqual({ in: ["org", "org2"] });
  });
});

describe("pauseCampaignsOfMailbox", () => {
  it("pauses the running campaigns of the mailbox", async () => {
    db.campaign.updateMany.mockResolvedValue({ count: 2 });
    expect(await pauseCampaignsOfMailbox("m1", NOW)).toBe(2);
    expect(db.campaign.updateMany).toHaveBeenCalledWith({
      where: { mailboxId: "m1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedAt: NOW },
    });
  });
});

describe("createCampaign", () => {
  const input = { organizationId: "org", createdById: "u1", name: " Q4 ", locale: "en", mailboxId: "m1", actor: ACTOR, now: NOW };
  beforeEach(() => db.campaign.create.mockResolvedValue({ id: "c1" }));

  it("binds an ACTIVE mailbox of the workspace", async () => {
    db.mailbox.findFirst.mockResolvedValue({ id: "m1" });
    expect(await createCampaign(input)).toEqual({ id: "c1" });
    expect(db.mailbox.findFirst.mock.calls[0][0].where).toEqual({
      id: "m1",
      organizationId: "org",
      status: "ACTIVE",
      userId: "u1",
    });
    expect(db.campaign.create.mock.calls[0][0].data).toMatchObject({ mailboxId: "m1", name: "Q4", locale: "en" });
  });

  it("drops a mailbox that is not the workspace's and falls back on the first locale", async () => {
    db.mailbox.findFirst.mockResolvedValue(null);
    await createCampaign({ ...input, locale: "de" });
    expect(db.campaign.create.mock.calls[0][0].data).toMatchObject({ mailboxId: null, locale: "fr" });
  });
});

describe("createCampaign by a manager", () => {
  it("may bind a colleague's mailbox: the lookup is not narrowed to the user", async () => {
    db.campaign.create.mockResolvedValue({ id: "c1" });
    db.mailbox.findFirst.mockResolvedValue({ id: "m1" });
    await createCampaign({ organizationId: "org", createdById: "u3", name: "Q", locale: "en", mailboxId: "m1", actor: MANAGER });
    expect(db.mailbox.findFirst.mock.calls[0][0].where).toEqual({ id: "m1", organizationId: "org", status: "ACTIVE" });
  });
});

describe("canEditCampaign", () => {
  it("allows the creator and managers only", () => {
    expect(canEditCampaign({ createdById: "u1" }, ACTOR)).toBe(true);
    expect(canEditCampaign({ createdById: "u1" }, STRANGER)).toBe(false);
    expect(canEditCampaign({ createdById: "u1" }, MANAGER)).toBe(true);
  });
});

describe("pauseCampaign", () => {
  it("pauses the creator's campaign and refuses a stranger's", async () => {
    db.campaign.findFirst.mockResolvedValue({ createdById: "u1", mailboxId: null });
    expect(await pauseCampaign("org", "c1", ACTOR, NOW)).toBe(true);
    db.campaign.updateMany.mockClear();
    expect(await pauseCampaign("org", "c1", STRANGER, NOW)).toBe(false);
    expect(db.campaign.updateMany).not.toHaveBeenCalled();
  });
});

describe("updateCampaign", () => {
  beforeEach(() => db.campaign.findFirst.mockResolvedValue({ createdById: "u1", mailboxId: "mine" }));

  it("only accepts an ACTIVE mailbox of the workspace", async () => {
    db.mailbox.findFirst.mockResolvedValue(null);
    expect(await updateCampaign("org", "c1", { mailboxId: "m1" }, ACTOR)).toBe(false);
    expect(db.mailbox.findFirst.mock.calls[0][0].where).toEqual({
      id: "m1",
      organizationId: "org",
      status: "ACTIVE",
      userId: "u1",
    });
    expect(db.campaign.updateMany).not.toHaveBeenCalled();
  });

  it("only accepts a READY, non-archived document of the workspace", async () => {
    db.document.findFirst.mockResolvedValue(null);
    expect(await updateCampaign("org", "c1", { documentId: "d1" }, ACTOR)).toBe(false);
    expect(db.document.findFirst.mock.calls[0][0].where).toEqual({
      id: "d1",
      organizationId: "org",
      status: "READY",
      archivedAt: null,
    });
  });

  it("refuses someone else's campaign", async () => {
    expect(await updateCampaign("org", "c1", { name: "x" }, STRANGER)).toBe(false);
    expect(db.campaign.updateMany).not.toHaveBeenCalled();
  });

  it("accepts the mailbox the campaign already uses, even a colleague's, without a lookup", async () => {
    expect(await updateCampaign("org", "c1", { mailboxId: "mine" }, ACTOR)).toBe(true);
    expect(db.mailbox.findFirst).not.toHaveBeenCalled();
  });

  it("moves the messages still SCHEDULED to the new mailbox, in the same transaction", async () => {
    db.mailbox.findFirst.mockResolvedValue({ id: "m2" });
    expect(await updateCampaign("org", "c1", { mailboxId: "m2" }, ACTOR)).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: "SCHEDULED" },
      data: { mailboxId: "m2" },
    });
  });

  it("leaves the messages alone when the mailbox does not change", async () => {
    expect(await updateCampaign("org", "c1", { mailboxId: "mine", name: "New" }, ACTOR)).toBe(true);
    expect(db.campaignMessage.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale", async () => {
    expect(await updateCampaign("org", "c1", { locale: "de" }, ACTOR)).toBe(false);
  });
});

describe("saveSteps", () => {
  it("writes nothing when the sequence is invalid", async () => {
    const result = await saveSteps("org", "c1", [], ACTOR);
    expect(result).toEqual({ ok: false, issues: [{ code: "no_steps" }] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("reports a missing campaign without writing", async () => {
    db.campaign.findFirst.mockResolvedValue(null);
    expect(await saveSteps("org", "nope", [goodStep], ACTOR)).toEqual({ ok: false, issues: [] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a teammate's campaign", async () => {
    db.campaign.findFirst.mockResolvedValue({ id: "c1", createdById: "u1" });
    expect(await saveSteps("org", "c1", [goodStep], STRANGER)).toEqual({ ok: false, issues: [] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("upserts by order and drops the surplus", async () => {
    db.campaign.findFirst.mockResolvedValue({ id: "c1", createdById: "u1" });
    expect(await saveSteps("org", "c1", [goodStep], ACTOR)).toEqual({ ok: true });
    expect((db.campaignStep.upsert.mock.calls[0][0] as { where: unknown }).where).toEqual({ campaignId_order: { campaignId: "c1", order: 1 } });
    expect(db.campaignStep.deleteMany).toHaveBeenCalledWith({ where: { campaignId: "c1", order: { gt: 1 } } });
  });
});
