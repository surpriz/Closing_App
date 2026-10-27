import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  campaignProspect: { findUnique: vi.fn(), updateMany: vi.fn((args: unknown) => ({ op: "enrollment", args })) },
  campaignMessage: { updateMany: vi.fn((args: unknown) => ({ op: "messages", args })) },
  prospect: { updateMany: vi.fn((args: unknown) => ({ op: "prospects", args })) },
  followup: { updateMany: vi.fn((args: unknown) => ({ op: "followups", args })) },
  $transaction: vi.fn(async () => []),
}));
const addSuppression = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/outreach/suppression", () => ({ addSuppression }));
vi.mock("@/lib/prospecting/opt-out", () => ({ addOptOut: vi.fn() }));
vi.mock("@/lib/seller-locale", () => ({ getSellerLocale: vi.fn(async () => "en"), toUiLocale: () => "en" }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));

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
  it("finds the enrollment and its sender", async () => {
    const target = await findUnsubscribeTarget(unsubscribeToken({ kind: "enrollment", id: "enr1" }));
    expect(target).toMatchObject({ kind: "enrollment", email: "Lea@Acme.com", alreadyDone: false, organizationId: "org1" });
    expect(target?.kind === "enrollment" && target.enrollment.campaign.mailbox.displayName).toBe("Paul");
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
    expect(db.prospect.updateMany).toHaveBeenCalled();
    expect(db.followup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED", error: "Prospect unsubscribed" }) }),
    );
  });
});

describe("unsubscribe urls", () => {
  it("puts the prefixed subject in the one-click url", () => {
    expect(unsubscribeOneClickUrl({ kind: "enrollment", id: "enr1" })).toMatch(/^https:\/\/app\.test\/api\/unsubscribe\/e:enr1\./);
  });
});
