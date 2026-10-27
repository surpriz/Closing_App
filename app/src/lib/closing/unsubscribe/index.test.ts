import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  campaignProspect: { findUnique: vi.fn(), updateMany: vi.fn((args: unknown) => ({ op: "enrollment", args })) },
  campaignMessage: { updateMany: vi.fn((args: unknown) => ({ op: "messages", args })) },
  prospect: { findUnique: vi.fn(), updateMany: vi.fn((args: unknown) => ({ op: "prospects", args })) },
  followup: { updateMany: vi.fn((args: unknown) => ({ op: "followups", args })) },
  $transaction: vi.fn(async () => []),
}));
const addSuppression = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/outreach/suppression", () => ({ addSuppression }));
vi.mock("@/lib/prospecting/opt-out", () => ({ addOptOut: vi.fn() }));
vi.mock("@/lib/seller-locale", () => ({ getSellerLocale: vi.fn(async () => "en"), toUiLocale: () => "en" }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));

import { createUnsubscribeToken } from "./token";
import { findUnsubscribeTarget, unsubscribeByToken, unsubscribeOneClickUrl, unsubscribeToken } from "./index";

const enrollmentRow = {
  id: "enr1",
  email: "Lea@Acme.com",
  status: "ACTIVE",
  organizationId: "org1",
  campaign: { createdById: "u1", mailbox: { displayName: "Paul", email: "paul@send.co" } },
};

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", "a-test-secret-that-is-long-enough-123");
  vi.clearAllMocks();
  db.campaignProspect.findUnique.mockResolvedValue(enrollmentRow);
});

describe("unsubscribe, enrollment subject", () => {
  it("finds the target from a percent-encoded legacy colon token", async () => {
    const legacy = createUnsubscribeToken("e:enr1", "a-test-secret-that-is-long-enough-123").replace("e:", "e%3A");
    expect(await findUnsubscribeTarget(legacy)).toMatchObject({ kind: "enrollment" });
  });

  it("finds the enrollment and its sender", async () => {
    const target = await findUnsubscribeTarget(unsubscribeToken({ kind: "enrollment", id: "enr1" }));
    expect(target).toMatchObject({ kind: "enrollment", email: "Lea@Acme.com", alreadyDone: false, organizationId: "org1" });
    expect(target?.kind === "enrollment" && target.enrollment.campaign.mailbox?.displayName).toBe("Paul");
  });

  it("reports an already unsubscribed enrollment", async () => {
    db.campaignProspect.findUnique.mockResolvedValue({ ...enrollmentRow, status: "UNSUBSCRIBED" });
    const target = await findUnsubscribeTarget(unsubscribeToken({ kind: "enrollment", id: "enr1" }));
    expect(target?.alreadyDone).toBe(true);
  });

  it("refuses a forged token", async () => {
    expect(await findUnsubscribeTarget("e:enr1.nope")).toBeNull();
    expect(await unsubscribeByToken("e:enr1.nope")).toBe(false);
  });

  it("stops the enrollment, cancels pending messages and suppresses the address", async () => {
    expect(await unsubscribeByToken(unsubscribeToken({ kind: "enrollment", id: "enr1" }))).toBe(true);

    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "enr1", status: { notIn: ["UNSUBSCRIBED"] } },
      data: { status: "UNSUBSCRIBED" },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "enr1", status: { in: ["SCHEDULED", "SENDING"] } },
      data: { status: "CANCELLED" },
    });
    expect(addSuppression).toHaveBeenCalledWith({
      organizationId: "org1",
      email: "Lea@Acme.com",
      reason: "UNSUBSCRIBE",
      source: "unsubscribe_page",
    });
    expect(addSuppression.mock.invocationCallOrder[0]).toBeLessThan(
      db.campaignProspect.updateMany.mock.invocationCallOrder[0],
    );
    expect(db.prospect.updateMany).toHaveBeenCalled();
    expect(db.followup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED", error: "Prospect unsubscribed" }) }),
    );
  });
});

describe("unsubscribe, prospect subject", () => {
  const prospectRow = {
    id: "pr1",
    email: "bob@acme.com",
    unsubscribedAt: null,
    origin: "MANUAL",
    linkId: "l1",
    link: { organizationId: "org1", createdBy: { locale: "en" } },
  };

  it("resolves a bare legacy token and suppresses before updating", async () => {
    db.prospect.findUnique.mockResolvedValue(prospectRow);
    const legacy = createUnsubscribeToken("pr1", "a-test-secret-that-is-long-enough-123");
    expect(await findUnsubscribeTarget(legacy)).toMatchObject({ kind: "prospect", email: "bob@acme.com", alreadyDone: false });

    expect(await unsubscribeByToken(legacy)).toBe(true);
    expect(addSuppression).toHaveBeenCalledWith({
      organizationId: "org1",
      email: "bob@acme.com",
      reason: "UNSUBSCRIBE",
      source: "unsubscribe_page",
    });
    expect(addSuppression.mock.invocationCallOrder[0]).toBeLessThan(db.prospect.updateMany.mock.invocationCallOrder[0]);
  });
});

describe("unsubscribe urls", () => {
  it("puts the prefixed subject in the one-click url", () => {
    expect(unsubscribeOneClickUrl({ kind: "enrollment", id: "enr1" })).toMatch(/^https:\/\/app\.test\/api\/unsubscribe\/e-enr1\./);
  });
});
