import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProspectRow } from "./csv";

const db = {
  campaign: { findFirst: vi.fn() },
  member: { findMany: vi.fn() },
  linkForward: { findFirst: vi.fn() },
  campaignProspect: { findMany: vi.fn(), createMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  campaignMessage: { updateMany: vi.fn() },
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
vi.mock("@/lib/closing/notify/preferences", () => ({
  getSellerPrefs: vi.fn(async () => ({ timezone: "Europe/Paris" })),
  sellerTimezone: (prefs: { timezone: string | null }) => prefs.timezone ?? "UTC",
}));

const { enrollForwardedContact, importProspects, prepareProspects, removeEnrollment, resumeEnrollment, stopEnrollment } = await import("./enroll");

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

  it("flips to ACTIVE and re-opens the failed or cancelled next step in one transaction, from the campaign's mailbox", async () => {
    expect(await resumeEnrollment("org", "e1", NOW, ACTOR)).toBe(true);
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", organizationId: "org", status: "PAUSED" },
      data: { status: "ACTIVE", pausedReason: null, pausedAt: null },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1", stepId: "s2", status: { in: ["FAILED", "CANCELLED"] } },
      data: { status: "SCHEDULED", scheduledFor: NOW, attempts: 0, messageId: null, sendingAt: null, error: null, mailboxId: "mb2" },
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

describe("enrollForwardedContact", () => {
  const forward = { toProspect: { id: "p9", email: "Boss@Acme.com", name: "Jane Roe Smith", company: "Acme" } };
  beforeEach(() => {
    vi.clearAllMocks();
    db.campaign.findFirst.mockResolvedValue({ locale: "fr", createdById: "u1" });
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
