import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProspectRow } from "./csv";

const db = {
  campaign: { findFirst: vi.fn() },
  member: { findMany: vi.fn() },
  linkForward: { findFirst: vi.fn() },
  campaignProspect: { findMany: vi.fn(), createMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  campaignMessage: { updateMany: vi.fn() },
  followup: { findMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(db) : Promise.all(arg as Promise<unknown>[]),
  ),
};
vi.mock("@/lib/db", () => ({ prisma: db }));
const suppressedAmong = vi.fn();
const isSuppressed = vi.fn();
vi.mock("./suppression", () => ({
  suppressedAmong: (...args: unknown[]) => suppressedAmong(...args),
  isSuppressed: (...args: unknown[]) => isSuppressed(...args),
}));
const scheduleStepMessage = vi.fn();
vi.mock("./messages", async () => ({
  ...(await vi.importActual<typeof import("./messages")>("./messages")),
  scheduleStepMessage: (...args: unknown[]) => scheduleStepMessage(...args),
}));
vi.mock("@/lib/closing/settings", () => ({
  getWorkspaceSettings: async () => ({ businessHourStart: 9, businessHourEnd: 18, businessDays: [1, 2, 3, 4, 5] }),
}));
const releaseCampaignLink = vi.fn();
vi.mock("./ownership", () => ({ releaseCampaignLink: (...args: unknown[]) => releaseCampaignLink(...args) }));
vi.mock("@/lib/seller-locale", async () => ({
  ...(await vi.importActual<typeof import("@/lib/seller-locale")>("@/lib/seller-locale")),
  getSellerLocale: vi.fn(async () => "fr"),
}));
vi.mock("@/lib/closing/notify/preferences", () => ({
  getSellerPrefs: vi.fn(async () => ({ timezone: "Europe/Paris" })),
  sellerTimezone: (prefs: { timezone: string | null }) => prefs.timezone ?? "UTC",
}));

const { enrollForwardedContact, importProspects, prepareProspects, removeEnrollment, resendBlockedStep, resumeEnrollment, skipBlockedStep, stopEnrollment } = await import("./enroll");

const NOW = new Date("2026-11-03T09:00:00Z");
const ACTOR = { userId: "u1", isManager: false };
const STRANGER = { userId: "u2", isManager: false };
const row = (email: string, over: Partial<ProspectRow> = {}): ProspectRow => ({
  email,
  firstName: null,
  lastName: null,
  company: null,
  title: null,
  country: null,
  timezone: null,
  locale: null,
  vars: {},
  ...over,
});
const ctx = { suppressed: new Set<string>(), teamEmails: [], sellerTimezone: "Europe/Paris", campaignLocale: "fr" };

describe("prepareProspects", () => {
  it("dedupes within the file whatever the case", () => {
    const result = prepareProspects([row("a@acme.com"), row("A@Acme.com")], ctx);
    expect(result.prospects).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  it("drops the workspace's own addresses", () => {
    const result = prepareProspects([row("me@acme.com"), row("them@beta.com")], { ...ctx, teamEmails: ["Me@acme.com"] });
    expect(result.prospects.map((p) => p.email)).toEqual(["them@beta.com"]);
    expect(result.team).toBe(1);
  });

  it("marks suppressed addresses without dropping them", () => {
    const [prospect] = prepareProspects([row("a@acme.com")], { ...ctx, suppressed: new Set(["a@acme.com"]) }).prospects;
    expect(prospect).toMatchObject({ status: "SUPPRESSED", pausedReason: "suppressed" });
  });

  it("resolves the timezone from the column, else the country, else the seller", () => {
    const zones = prepareProspects(
      [row("a@x.com", { timezone: "America/New_York" }), row("b@x.com", { country: "Allemagne" }), row("c@x.com")],
      ctx,
    ).prospects.map((p) => p.timezone);
    expect(zones).toEqual(["America/New_York", "Europe/Berlin", "Europe/Paris"]);
  });

  it("keeps a supported row locale and falls back to the campaign's", () => {
    const locales = prepareProspects([row("a@x.com", { locale: "EN" }), row("b@x.com", { locale: "xx" }), row("c@x.com")], ctx)
      .prospects.map((p) => p.locale);
    expect(locales).toEqual(["en", "fr", "fr"]);
  });

  it("counts free mailboxes as a warning", () => {
    const result = prepareProspects([row("a@gmail.com"), row("b@hotmail.fr"), row("c@acme.com")], ctx);
    expect(result.personal).toBe(2);
    expect(result.prospects).toHaveLength(3);
  });
});

describe("importProspects", () => {
  const base = { organizationId: "org", campaignId: "c1", sellerTimezone: "Europe/Paris", actor: ACTOR, now: NOW };

  beforeEach(() => {
    vi.clearAllMocks();
    db.campaign.findFirst.mockResolvedValue({ locale: "fr", createdById: "u1", steps: [] });
    db.member.findMany.mockResolvedValue([{ user: { email: "me@mine.com" } }]);
    suppressedAmong.mockResolvedValue(new Set());
    db.campaignProspect.findMany.mockResolvedValue([]);
    db.campaignProspect.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  });

  it("refuses an unknown or archived campaign", async () => {
    db.campaign.findFirst.mockResolvedValue(null);
    expect(await importProspects({ ...base, csv: "email\na@x.com" })).toEqual({ error: "campaign_not_found" });
    expect(db.campaign.findFirst.mock.calls[0][0].where).toMatchObject({ status: { not: "ARCHIVED" } });
  });

  it("refuses a teammate's campaign", async () => {
    expect(await importProspects({ ...base, actor: STRANGER, csv: "email\na@x.com" })).toEqual({ error: "campaign_not_found" });
    expect(db.campaignProspect.createMany).not.toHaveBeenCalled();
  });

  it("reports an empty file", async () => {
    expect(await importProspects({ ...base, csv: "email\n" })).toEqual({ error: "empty" });
  });

  it("refuses a file without a header line, naming what it read", async () => {
    const csv = "laval0jerome@gmail.com;Jerome;Google\r\njerome@waltio.co;Jerome;Waltio\r\n";
    expect(await importProspects({ ...base, csv })).toEqual({
      error: "no_header",
      headers: ["laval0jerome@gmail.com", "Jerome", "Google"],
    });
    expect(await importProspects({ ...base, csv: "Prénom,Société\nAda,Acme\n" })).toEqual({
      error: "no_email_column",
      headers: ["Prénom", "Société"],
    });
    expect(db.campaignProspect.createMany).not.toHaveBeenCalled();
  });

  it("imports nothing past the row limit", async () => {
    const csv = ["email", ...Array.from({ length: 2001 }, (_, i) => `p${i}@x.com`)].join("\n");
    const result = await importProspects({ ...base, csv });
    expect(result).toMatchObject({ tooMany: true, enrolled: 0 });
    expect(db.campaignProspect.createMany).not.toHaveBeenCalled();
  });

  it("returns the detected mapping and creates the enrollments with skipDuplicates", async () => {
    const csv = "Prénom,E-mail,Société\nAda,ada@acme.com,Acme\nBad,nope,Acme\n";
    const result = await importProspects({ ...base, csv });
    expect(result).toMatchObject({
      mapping: { email: "E-mail", firstName: "Prénom", company: "Société" },
      enrolled: 1,
      rejected: [{ line: 3, reason: "invalid_email" }],
    });
    const call = db.campaignProspect.createMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data[0]).toMatchObject({ campaignId: "c1", organizationId: "org", email: "ada@acme.com", status: "QUEUED" });
  });

  it("counts suppressed, team, already-in-campaign and elsewhere separately", async () => {
    suppressedAmong.mockResolvedValue(new Set(["stop@x.com"]));
    db.campaignProspect.findMany.mockResolvedValue([
      { email: "dup@x.com", campaignId: "c1", status: "QUEUED" },
      { email: "busy@x.com", campaignId: "c2", status: "ACTIVE" },
    ]);
    const csv = "email\nme@mine.com\nstop@x.com\ndup@x.com\nbusy@x.com\nnew@x.com\nnew@x.com\n";
    const result = await importProspects({ ...base, csv });
    expect(result).toMatchObject({ team: 1, suppressed: 1, duplicates: 2, elsewhere: 1, enrolled: 2 });
    const emails = db.campaignProspect.createMany.mock.calls[0][0].data.map((d: { email: string }) => d.email);
    expect(emails).toEqual(["stop@x.com", "busy@x.com", "new@x.com"]);
  });

  it("re-adds a prospect the seller removed before any send, with the file's data", async () => {
    db.campaignProspect.findMany.mockResolvedValue([
      { id: "e1", email: "back@x.com", campaignId: "c1", status: "STOPPED", currentStep: 0 },
      { id: "e2", email: "sent@x.com", campaignId: "c1", status: "STOPPED", currentStep: 1 },
    ]);
    db.campaignProspect.updateMany.mockResolvedValue({ count: 1 });
    const csv = "email,prénom\nback@x.com,Ada\nsent@x.com,Bob\n";
    const result = await importProspects({ ...base, csv });
    expect(result).toMatchObject({ enrolled: 1, duplicates: 1 });
    expect(db.campaignProspect.createMany).not.toHaveBeenCalled();
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1", status: "STOPPED", currentStep: 0 },
        data: expect.objectContaining({ firstName: "Ada", status: "QUEUED", finishedAt: null, nextSendAt: null }),
      }),
    );
  });

  it("counts the enrolled rows that lack a variable the steps use without fallback", async () => {
    db.campaign.findFirst.mockResolvedValue({
      locale: "fr",
      createdById: "u1",
      steps: [
        { subject: "Hi {{firstName}}", body: "About {{city}}, {{role|your team}} and {{link}}" },
        { subject: null, body: "Still in {{City}}?" },
      ],
    });
    suppressedAmong.mockResolvedValue(new Set(["stop@x.com"]));
    const csv = "email,Prénom,city\nann@x.com,Ann,Lyon\nbob@x.com,,Paris\ncy@x.com,Cy,\nstop@x.com,,\n";
    const result = await importProspects({ ...base, csv });
    // bob has no first name, cy no city; the suppressed row never sends, {{role}} has a fallback, {{link}} is ours
    expect(result).toMatchObject({ enrolled: 3, missingVariables: 2 });
    expect(db.campaign.findFirst.mock.calls[0][0].select).toMatchObject({ steps: { select: { subject: true, body: true } } });
  });
});

describe("stopEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.campaignProspect.updateMany.mockResolvedValue({ count: 1 });
    db.campaignMessage.updateMany.mockResolvedValue({ count: 0 });
    db.campaignProspect.findUnique.mockResolvedValue({ linkId: null, campaign: { createdById: "u1" } });
    db.followup.findMany.mockResolvedValue([]);
  });

  it("releases the link and cancels the open campaign follow-ups with a reason in the seller's language", async () => {
    db.campaignProspect.findUnique.mockResolvedValue({ linkId: "l1", campaign: { createdById: "u1" } });
    db.followup.findMany.mockResolvedValue([{ id: "f1" }, { id: "f2" }]);
    expect(await stopEnrollment("e1", "STOPPED", "seller", NOW)).toBe(true);
    expect(releaseCampaignLink).toHaveBeenCalledWith("l1");
    expect(db.followup.findMany).toHaveBeenCalledWith({
      where: { campaignProspectId: "e1", status: { in: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"] } },
      select: { id: true },
    });
    expect(db.followup.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["f1", "f2"] }, status: { in: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"] } },
      data: { status: "CANCELLED", cancelledAt: NOW, error: "La campagne s'est arrêtée pour ce contact" },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { followupId: { in: ["f1", "f2"] }, status: { in: ["SCHEDULED", "SENDING"] } },
      data: { status: "CANCELLED", sendingAt: null },
    });
  });

  it("touches neither the link nor the follow-ups when the enrollment was already over", async () => {
    db.campaignProspect.findUnique.mockResolvedValue({ linkId: "l1", campaign: { createdById: "u1" } });
    db.campaignProspect.updateMany.mockResolvedValue({ count: 0 });
    expect(await stopEnrollment("e1", "STOPPED", "seller", NOW)).toBe(false);
    expect(releaseCampaignLink).not.toHaveBeenCalled();
    expect(db.followup.findMany).not.toHaveBeenCalled();
  });

  it("only touches live enrollments and cancels their pending messages", async () => {
    expect(await stopEnrollment("e1", "REPLIED", "reply", NOW)).toBe(true);
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: { in: ["QUEUED", "ACTIVE", "PAUSED"] } },
      data: { status: "REPLIED", finishedAt: NOW, pausedReason: "reply", repliedAt: NOW },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1", status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
  });

  it("leaves a finished enrollment alone", async () => {
    db.campaignProspect.updateMany.mockResolvedValue({ count: 0 });
    expect(await stopEnrollment("e1", "BOUNCED", null, NOW)).toBe(false);
  });
});

describe("removeEnrollment", () => {
  it("is scoped to the workspace", async () => {
    vi.clearAllMocks();
    db.campaignProspect.findFirst.mockResolvedValue(null);
    expect(await removeEnrollment("org", "e1", NOW, ACTOR)).toBe(false);
    expect(db.campaignProspect.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an enrollment of a teammate's campaign", async () => {
    vi.clearAllMocks();
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1", campaign: { createdById: "u1" } });
    expect(await removeEnrollment("org", "e1", NOW, STRANGER)).toBe(false);
    expect(db.campaignProspect.updateMany).not.toHaveBeenCalled();
  });

  it("stops the enrollment as the seller", async () => {
    vi.clearAllMocks();
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1", campaign: { createdById: "u1" } });
    db.campaignProspect.updateMany.mockResolvedValue({ count: 1 });
    db.campaignMessage.updateMany.mockResolvedValue({ count: 1 });
    expect(await removeEnrollment("org", "e1", NOW, ACTOR)).toBe(true);
    expect(db.campaignProspect.findFirst.mock.calls[0][0].where).toEqual({ id: "e1", organizationId: "org" });
    expect(db.campaignProspect.updateMany.mock.calls[0][0].data).toMatchObject({ status: "STOPPED", pausedReason: "seller" });
  });
});

describe("resumeEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1", campaign: { createdById: "u1" } });
    db.campaignProspect.updateMany.mockResolvedValue({ count: 1 });
    db.campaignProspect.findUnique.mockResolvedValue({
      currentStep: 1,
      campaign: {
        mailboxId: "mb2",
        steps: [
          { id: "s1", order: 1 },
          { id: "s2", order: 2 },
        ],
      },
    });
    db.campaignMessage.updateMany.mockResolvedValue({ count: 1 });
  });

  it("flips to ACTIVE and re-opens the next step in one transaction, from the campaign's mailbox, never one that may have left", async () => {
    expect(await resumeEnrollment("org", "e1", NOW, ACTOR)).toBe(true);
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", organizationId: "org", status: "PAUSED", pausedReason: null },
      data: { status: "ACTIVE", pausedReason: null, pausedAt: null },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1", stepId: "s2", OR: [{ status: "CANCELLED" }, { status: "FAILED", messageId: null }] },
      data: { status: "SCHEDULED", scheduledFor: NOW, attempts: 0, messageId: null, sendingAt: null, error: null, mailboxId: "mb2" },
    });
  });

  it("keeps a failed step with a Message-ID blocked on any other pause", async () => {
    db.campaignProspect.findUnique.mockResolvedValue({
      currentStep: 1,
      pausedReason: "send_failed",
      campaign: { mailboxId: "mb2", steps: [{ id: "s1", order: 1 }, { id: "s2", order: 2 }] },
    });
    expect(await resumeEnrollment("org", "e1", NOW, ACTOR)).toBe(true);
    expect(db.campaignProspect.updateMany.mock.calls[0][0].where.pausedReason).toBe("send_failed");
    expect(db.campaignMessage.updateMany.mock.calls[0][0].where).toEqual({
      enrollmentId: "e1",
      stepId: "s2",
      OR: [{ status: "CANCELLED" }, { status: "FAILED", messageId: null }],
    });
  });

  it("re-opens a failed step with a Message-ID from an interrupted pause (the seller confirmed it did not leave)", async () => {
    db.campaignProspect.findUnique.mockResolvedValue({
      currentStep: 1,
      pausedReason: "interrupted",
      campaign: { mailboxId: "mb2", steps: [{ id: "s1", order: 1 }, { id: "s2", order: 2 }] },
    });
    expect(await resumeEnrollment("org", "e1", NOW, ACTOR)).toBe(true);
    expect(db.campaignMessage.updateMany.mock.calls[0][0].where).toEqual({
      enrollmentId: "e1",
      stepId: "s2",
      status: { in: ["FAILED", "CANCELLED"] },
    });
  });

  it("refuses a teammate's enrollment", async () => {
    expect(await resumeEnrollment("org", "e1", NOW, STRANGER)).toBe(false);
    expect(db.campaignProspect.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when the enrollment was not paused", async () => {
    db.campaignProspect.updateMany.mockResolvedValue({ count: 0 });
    expect(await resumeEnrollment("org", "e1", NOW, ACTOR)).toBe(false);
    expect(db.campaignMessage.updateMany).not.toHaveBeenCalled();
  });
});

describe("resendBlockedStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.campaignProspect.findFirst.mockResolvedValue({
      id: "e1",
      currentStep: 1,
      campaign: { createdById: "u1", mailboxId: "mb2", steps: [{ id: "s1", order: 1 }, { id: "s2", order: 2 }] },
    });
    db.campaignProspect.updateMany.mockResolvedValue({ count: 1 });
    db.campaignMessage.updateMany.mockResolvedValue({ count: 1 });
  });

  it("re-opens the FAILED row that has a Message-ID, from the campaign's mailbox, and plans it now", async () => {
    expect(await resendBlockedStep("org", "e1", ACTOR, NOW)).toBe(true);
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1", stepId: "s2", enrollment: { status: "ACTIVE" }, status: "FAILED", messageId: { not: null } },
      data: { status: "SCHEDULED", scheduledFor: NOW, attempts: 0, messageId: null, sendingAt: null, error: null, mailboxId: "mb2" },
    });
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { nextSendAt: NOW },
    });
  });

  it("refuses a teammate's enrollment", async () => {
    expect(await resendBlockedStep("org", "e1", STRANGER, NOW)).toBe(false);
    expect(db.campaignMessage.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when no row is in that state", async () => {
    db.campaignMessage.updateMany.mockResolvedValue({ count: 0 });
    expect(await resendBlockedStep("org", "e1", ACTOR, NOW)).toBe(false);
    expect(db.campaignProspect.updateMany).not.toHaveBeenCalled();
  });
});

describe("skipBlockedStep", () => {
  const step = (id: string, order: number, delayDays: number) => ({
    id,
    order,
    delayDays,
    subject: null,
    newThread: false,
    body: "Hi",
    carriesLink: false,
  });
  const enrollment = (currentStep: number, steps = [step("s1", 1, 0), step("s2", 2, 2), step("s3", 3, 3)]) => ({
    id: "e1",
    currentStep,
    timezone: "Europe/Paris",
    campaign: { id: "c1", createdById: "u1", mailboxId: "mb2", steps },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db.campaignProspect.findFirst.mockResolvedValue(enrollment(1));
    db.campaignProspect.updateMany.mockResolvedValue({ count: 1 });
    db.campaignMessage.updateMany.mockResolvedValue({ count: 1 });
    scheduleStepMessage.mockResolvedValue({ id: "m3" });
  });

  it("cancels the row as skipped, moves past the step and plans the following one after its delay", async () => {
    expect(await skipBlockedStep("org", "e1", ACTOR, NOW)).toBe(true);
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1", stepId: "s2", enrollment: { status: "ACTIVE" }, status: "FAILED", messageId: { not: null } },
      data: { status: "CANCELLED", error: "skipped", sendingAt: null },
    });
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE", currentStep: 1 },
      data: { currentStep: 2, nextSendAt: null },
    });
    const planned = scheduleStepMessage.mock.calls[0][0];
    expect(planned).toMatchObject({ campaignId: "c1", mailboxId: "mb2", step: { id: "s3" } });
    expect(planned.scheduledFor.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 3 * 86_400_000);
    expect(db.campaignProspect.updateMany).toHaveBeenLastCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { nextSendAt: planned.scheduledFor },
    });
  });

  it("plans nothing when the skipped step was the last one", async () => {
    db.campaignProspect.findFirst.mockResolvedValue(enrollment(2));
    expect(await skipBlockedStep("org", "e1", ACTOR, NOW)).toBe(true);
    expect(scheduleStepMessage).not.toHaveBeenCalled();
  });

  it("refuses a teammate's enrollment", async () => {
    expect(await skipBlockedStep("org", "e1", STRANGER, NOW)).toBe(false);
    expect(db.campaignMessage.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when no row is in that state", async () => {
    db.campaignMessage.updateMany.mockResolvedValue({ count: 0 });
    expect(await skipBlockedStep("org", "e1", ACTOR, NOW)).toBe(false);
    expect(db.campaignProspect.updateMany).not.toHaveBeenCalled();
    expect(scheduleStepMessage).not.toHaveBeenCalled();
  });
});

describe("enrollForwardedContact", () => {
  const forward = { toProspect: { id: "p9", email: "Boss@Acme.com", name: "Jane Roe Smith", company: "Acme" } };
  beforeEach(() => {
    vi.clearAllMocks();
    db.campaign.findFirst.mockResolvedValue({ locale: "fr", createdById: "u1", status: "ACTIVE" });
    db.linkForward.findFirst.mockResolvedValue(forward);
    isSuppressed.mockResolvedValue(false);
    db.campaignProspect.findFirst.mockResolvedValue(null);
    db.campaignProspect.create.mockResolvedValue({});
  });

  it("enrolls the contact in a fresh QUEUED enrollment tagged with its origin", async () => {
    expect(await enrollForwardedContact("c1", "p9", ACTOR, NOW, "o1")).toBe("enrolled");
    expect(db.campaignProspect.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "c1",
        organizationId: "o1",
        email: "boss@acme.com",
        firstName: "Jane",
        lastName: "Roe Smith",
        company: "Acme",
        vars: { source: "forward:p9" },
        timezone: "Europe/Paris",
        locale: "fr",
        status: "QUEUED",
      }),
    });
  });

  it("refuses a campaign that is over", async () => {
    db.campaign.findFirst.mockResolvedValue({ locale: "fr", createdById: "u1", status: "DONE" });
    expect(await enrollForwardedContact("c1", "p9", ACTOR, NOW, "o1")).toBe("campaign_closed");
    expect(db.campaignProspect.create).not.toHaveBeenCalled();
    for (const status of ["DRAFT", "PAUSED"]) {
      db.campaign.findFirst.mockResolvedValue({ locale: "fr", createdById: "u1", status });
      expect(await enrollForwardedContact("c1", "p9", ACTOR, NOW, "o1")).toBe("enrolled");
    }
  });

  it("skips an address already enrolled", async () => {
    db.campaignProspect.findFirst.mockResolvedValue({ id: "e1" });
    expect(await enrollForwardedContact("c1", "p9", ACTOR, NOW, "o1")).toBe("duplicate");
    expect(db.campaignProspect.create).not.toHaveBeenCalled();
  });

  it("treats a lost unique race as a duplicate", async () => {
    db.campaignProspect.create.mockRejectedValue({ code: "P2002" });
    expect(await enrollForwardedContact("c1", "p9", ACTOR, NOW, "o1")).toBe("duplicate");
  });

  it("skips a suppressed address", async () => {
    isSuppressed.mockResolvedValue(true);
    expect(await enrollForwardedContact("c1", "p9", ACTOR, NOW, "o1")).toBe("suppressed");
    expect(db.campaignProspect.create).not.toHaveBeenCalled();
  });

  it("refuses a prospect that is not a forward recipient of the campaign, or a non-editor", async () => {
    db.linkForward.findFirst.mockResolvedValue(null);
    expect(await enrollForwardedContact("c1", "p9", ACTOR, NOW, "o1")).toBe("not_found");
    db.linkForward.findFirst.mockResolvedValue(forward);
    expect(await enrollForwardedContact("c1", "p9", STRANGER, NOW, "o1")).toBe("not_found");
  });
});
