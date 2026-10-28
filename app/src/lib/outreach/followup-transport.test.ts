import { beforeEach, describe, expect, it, vi } from "vitest";

import { MailboxError } from "@/lib/mailboxes/errors";

const calls: string[] = [];
const db = vi.hoisted(() => ({
  followup: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  campaignMessage: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  campaignProspect: { updateMany: vi.fn() },
  mailbox: { update: vi.fn() },
}));
const mocks = vi.hoisted(() => ({
  reserveSend: vi.fn(),
  notifyMailboxOwner: vi.fn(),
  isSuppressed: vi.fn(),
  orgIds: ["org1"] as string[],
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/mailboxes/caps/counter", () => ({ reserveSend: mocks.reserveSend }));
vi.mock("@/lib/mailboxes/notify-owner", () => ({ notifyMailboxOwner: mocks.notifyMailboxOwner }));
vi.mock("./flag", () => ({ outreachOrgIds: () => mocks.orgIds }));
vi.mock("./suppression", () => ({ isSuppressed: mocks.isSuppressed }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_DAILY_CAP_MAX: 100 }) }));
vi.mock("@/lib/closing/settings", () => ({
  getWorkspaceSettings: async () => ({ businessHourStart: 9, businessHourEnd: 18, businessDays: [1, 2, 3, 4, 5] }),
}));

const { reconcileFollowupMirrors, sendCampaignFollowup } = await import("./followup-transport");

process.env.ENCRYPTION_KEY = "k".repeat(40);

const now = new Date("2026-10-28T10:00:00Z");
const mailbox = { id: "mb1", organizationId: "org1", status: "ACTIVE", email: "me@seller.test", timezone: "UTC", signature: null };

function followup(over: Record<string, unknown> = {}) {
  return {
    id: "f1",
    status: "GENERATED",
    body: "Bonjour, voici https://app.test/v/acme-abc123xyz comme promis.",
    subject: "Suite",
    locale: "fr",
    approvedAt: null,
    prospect: { company: "Acme" },
    link: { slug: "abc123xyz", document: { name: "Devis", displayTitle: null, docType: null } },
    campaignProspect: {
      id: "e1",
      organizationId: "org1",
      email: "p@acme.test",
      firstName: "Marie",
      lastName: null,
      locale: "fr",
      status: "PAUSED",
      threadSubject: "Devis cuisine",
      firstMessageId: "<first@x>",
      providerThreadId: null,
      campaign: { id: "c1", status: "ACTIVE", mailboxId: "mb1", mailbox, organization: { suspendedAt: null as Date | null } },
    },
    ...over,
  };
}

const track = (name: string, value: unknown = { count: 1 }) =>
  vi.fn(async () => {
    calls.push(name);
    return value;
  });

function fakeConnector(send = vi.fn(async () => ({ messageId: "<out@x>", providerId: "p1", threadId: "t1" }))) {
  const wrapped = vi.fn(async (m: unknown) => {
    calls.push("send");
    return (send as (m: unknown) => ReturnType<typeof send>)(m);
  });
  return { send: wrapped, capabilities: { listUnsubscribe: true } };
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  mocks.orgIds = ["org1"];
  mocks.isSuppressed.mockResolvedValue(false);
  mocks.reserveSend.mockImplementation(track("reserve", true));
  db.followup.findUnique.mockResolvedValue(followup());
  db.followup.updateMany.mockImplementation(track("claim"));
  db.followup.update.mockResolvedValue({});
  db.campaignMessage.create.mockImplementation(track("mirror", { id: "m1" }));
  db.campaignMessage.findFirst.mockResolvedValue({ messageId: "<prev@x>" });
  db.campaignMessage.updateMany.mockResolvedValue({ count: 1 });
  db.campaignProspect.updateMany.mockImplementation(track("resume"));
});

describe("sendCampaignFollowup", () => {
  it("claims, reserves, sends in thread, mirrors and resumes the enrollment", async () => {
    const connector = fakeConnector();
    const outcome = await sendCampaignFollowup("f1", now, { connector: () => connector as never });
    expect(outcome).toBe("sent");
    expect(calls).toEqual(["mirror", "claim", "reserve", "send", "resume"]);
    expect(db.followup.updateMany.mock.calls[0][0].data).toMatchObject({ status: "SENT", sentVia: "MAILBOX" });
    const sent = connector.send.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).toMatchObject({ subject: "Re: Devis cuisine", inReplyTo: "<prev@x>", references: ["<first@x>", "<prev@x>"] });
    expect(String(sent.text)).toContain("comme promis");
    expect(sent.headers).toBeTruthy();
    expect(db.campaignMessage.create.mock.calls[0][0].data).toMatchObject({
      kind: "FOLLOWUP",
      dedupeKey: "cold:e1:fu:f1",
      stepId: null,
      carriesLink: true,
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SENT", messageId: "<out@x>", threadId: "t1" }) }),
    );
    // Only the reading alerts' pauses end with the follow-up: a manual or failure pause stays
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "PAUSED", pausedReason: { in: ["call_moment", "deep_read"] } },
      data: { status: "ACTIVE", pausedReason: null, pausedAt: null },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: expect.objectContaining({ status: "SENT", sentAt: now }),
    });
  });

  it("takes the lease of a SCHEDULED mirror left by an earlier try", async () => {
    db.campaignMessage.create.mockRejectedValue({ code: "P2002" });
    db.campaignMessage.findUnique.mockResolvedValue({ id: "m0", status: "SCHEDULED", sentAt: null, attempts: 1 });
    const connector = fakeConnector();
    expect(await sendCampaignFollowup("f1", now, { connector: () => connector as never })).toBe("sent");
    expect(db.campaignMessage.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "m0", status: { in: ["SCHEDULED", "CANCELLED", "FAILED"] } },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    expect(connector.send).toHaveBeenCalledTimes(1);
  });

  it("reprograms on QUOTA without a send", async () => {
    const send = vi.fn(async (): Promise<never> => {
      throw new MailboxError("QUOTA", "slow down", { retryAfterMs: 3_600_000 });
    });
    const outcome = await sendCampaignFollowup("f1", now, { connector: () => fakeConnector(send) as never });
    expect(outcome).toBe("rescheduled");
    expect(db.followup.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "GENERATED", sentAt: null, sentVia: null, scheduledFor: new Date(now.getTime() + 3_600_000) },
    });
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SCHEDULED" }) }),
    );
    expect(db.campaignProspect.updateMany).not.toHaveBeenCalled();
  });

  it("reprograms when the daily cap is used up, nothing is sent", async () => {
    mocks.reserveSend.mockResolvedValue(false);
    const connector = fakeConnector();
    expect(await sendCampaignFollowup("f1", now, { connector: () => connector as never })).toBe("rescheduled");
    expect(connector.send).not.toHaveBeenCalled();
    expect(db.followup.update.mock.calls[0][0].data.status).toBe("GENERATED");
  });

  it("is idempotent when the mirror is already SENT", async () => {
    db.campaignMessage.create.mockRejectedValue({ code: "P2002" });
    db.campaignMessage.findUnique.mockResolvedValue({ id: "m1", status: "SENT", sentAt: now });
    const connector = fakeConnector();
    expect(await sendCampaignFollowup("f1", now, { connector: () => connector as never })).toBe("ignored");
    expect(connector.send).not.toHaveBeenCalled();
    expect(mocks.reserveSend).not.toHaveBeenCalled();
    expect(db.followup.updateMany.mock.calls[0][0].data).toMatchObject({ status: "SENT", sentVia: "MAILBOX" });
  });

  it("reprograms one hour later when the campaign has no active mailbox", async () => {
    const f = followup();
    f.campaignProspect.campaign.mailbox = { ...mailbox, status: "ERROR" };
    db.followup.findUnique.mockResolvedValue(f);
    const connector = fakeConnector();
    expect(await sendCampaignFollowup("f1", now, { connector: () => connector as never })).toBe("rescheduled");
    expect(db.followup.updateMany.mock.calls[0][0].data).toEqual({
      scheduledFor: new Date(now.getTime() + 3_600_000),
      error: "no_mailbox",
    });
    expect(connector.send).not.toHaveBeenCalled();
    expect(db.campaignMessage.create).not.toHaveBeenCalled();
  });

  it("marks the mailbox ERROR and fails the follow-up on AUTH_REVOKED", async () => {
    const send = vi.fn(async (): Promise<never> => {
      throw new MailboxError("AUTH_REVOKED", "token revoked");
    });
    expect(await sendCampaignFollowup("f1", now, { connector: () => fakeConnector(send) as never })).toBe("failed");
    expect(db.mailbox.update.mock.calls[0][0].data).toMatchObject({ status: "ERROR", lastError: "AUTH_REVOKED: token revoked" });
    expect(mocks.notifyMailboxOwner).toHaveBeenCalledWith("mb1", "auth_revoked", "token revoked", now);
    expect(db.followup.update.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("pushes a follow-up of a paused campaign one hour on", async () => {
    const f = followup();
    f.campaignProspect.campaign.status = "PAUSED";
    db.followup.findUnique.mockResolvedValue(f);
    expect(await sendCampaignFollowup("f1", now)).toBe("ignored");
    expect(db.followup.updateMany.mock.calls[0][0].data).toEqual({ scheduledFor: new Date(now.getTime() + 3_600_000) });
    expect(db.campaignMessage.create).not.toHaveBeenCalled();
  });

  it("holds the follow-up one hour when the workspace left the beta or is suspended", async () => {
    mocks.orgIds = [];
    expect(await sendCampaignFollowup("f1", now)).toBe("ignored");
    expect(db.followup.updateMany.mock.calls[0][0].data).toEqual({ scheduledFor: new Date(now.getTime() + 3_600_000) });

    mocks.orgIds = ["org1"];
    db.followup.updateMany.mockClear();
    const f = followup();
    f.campaignProspect.campaign.organization.suspendedAt = now;
    db.followup.findUnique.mockResolvedValue(f);
    expect(await sendCampaignFollowup("f1", now)).toBe("ignored");
    expect(db.followup.updateMany.mock.calls[0][0].data).toEqual({ scheduledFor: new Date(now.getTime() + 3_600_000) });
    expect(db.campaignMessage.create).not.toHaveBeenCalled();
  });

  it("cancels a follow-up of a finished campaign with the given reason", async () => {
    const f = followup();
    f.campaignProspect.campaign.status = "DONE";
    db.followup.findUnique.mockResolvedValue(f);
    expect(await sendCampaignFollowup("f1", now, { endedReason: "Driven by the campaign" })).toBe("cancelled");
    expect(db.followup.updateMany.mock.calls[0][0].data).toMatchObject({ status: "CANCELLED", error: "Driven by the campaign" });
    expect(db.campaignMessage.create).not.toHaveBeenCalled();
  });

  it("rolls the claim back when something throws before the mail is handed over", async () => {
    mocks.reserveSend.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const connector = fakeConnector();
    expect(await sendCampaignFollowup("f1", now, { connector: () => connector as never })).toBe("failed");
    expect(connector.send).not.toHaveBeenCalled();
    expect(db.followup.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { status: "GENERATED", sentAt: null, sentVia: null, scheduledFor: new Date(now.getTime() + 1_800_000) },
    });
  });

  it("leaves the claim for the reconciliation when it throws after the send", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.followup.update.mockRejectedValue(new Error("db down"));
    const connector = fakeConnector();
    expect(await sendCampaignFollowup("f1", now, { connector: () => connector as never })).toBe("failed");
    expect(connector.send).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure in 30 minutes without telling anyone", async () => {
    const send = vi.fn(async (): Promise<never> => {
      throw new MailboxError("TRANSIENT", "unreachable", { detail: "ECONNREFUSED" });
    });
    expect(await sendCampaignFollowup("f1", now, { connector: () => fakeConnector(send) as never })).toBe("rescheduled");
    expect(db.followup.update.mock.calls[0][0].data).toMatchObject({ status: "GENERATED", scheduledFor: new Date(now.getTime() + 1_800_000) });
    expect(mocks.notifyMailboxOwner).not.toHaveBeenCalled();
    expect(db.campaignProspect.updateMany).not.toHaveBeenCalled();
  });

  it("retries another transient failure while attempts remain, then fails, pauses and notifies", async () => {
    const send = vi.fn(async (): Promise<never> => {
      throw new MailboxError("TRANSIENT", "greylisted", { detail: "451" });
    });
    expect(await sendCampaignFollowup("f1", now, { connector: () => fakeConnector(send) as never })).toBe("rescheduled");
    expect(mocks.notifyMailboxOwner).not.toHaveBeenCalled();

    db.campaignMessage.create.mockRejectedValue({ code: "P2002" });
    db.campaignMessage.findUnique.mockResolvedValue({ id: "m1", status: "SCHEDULED", sentAt: null, attempts: 2 });
    expect(await sendCampaignFollowup("f1", now, { connector: () => fakeConnector(send) as never })).toBe("failed");
    expect(db.followup.update).toHaveBeenLastCalledWith({
      where: { id: "f1" },
      data: { status: "FAILED", sentAt: null, error: "TRANSIENT: greylisted" },
    });
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "send_failed", pausedAt: now },
    });
    expect(mocks.notifyMailboxOwner).toHaveBeenCalledWith("mb1", "send_failed", "TRANSIENT: greylisted", now);
  });

  it("pauses with reason rejected on REJECTED", async () => {
    const send = vi.fn(async (): Promise<never> => {
      throw new MailboxError("REJECTED", "no such user");
    });
    await sendCampaignFollowup("f1", now, { connector: () => fakeConnector(send) as never });
    expect(db.campaignProspect.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "rejected", pausedAt: now },
    });
  });
});

describe("reconcileFollowupMirrors", () => {
  const old = new Date(now.getTime() - 10 * 60_000);
  const mirror = (over: Record<string, unknown>) => ({
    id: "m1",
    enrollmentId: "e1",
    sendingAt: old,
    messageId: null,
    followup: { id: "f1", status: "SENT", sentAt: old },
    ...over,
  });

  it("closes a mirror whose follow-up is SENT and resumes the enrollment", async () => {
    db.campaignMessage.findMany.mockResolvedValue([mirror({ messageId: "<m@x>" })]);
    expect(await reconcileFollowupMirrors(now)).toBe(1);
    expect(db.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: old },
      data: { status: "SENT", sentAt: old, sendingAt: null },
    });
    expect(db.campaignProspect.updateMany).toHaveBeenCalled();
  });

  it("fails both when the Message-ID exists but the follow-up was not SENT", async () => {
    db.campaignMessage.findMany.mockResolvedValue([mirror({ messageId: "<m@x>", followup: { id: "f1", status: "GENERATED", sentAt: null } })]);
    await reconcileFollowupMirrors(now);
    expect(db.campaignMessage.updateMany.mock.calls[0][0].data).toMatchObject({ status: "FAILED", error: "interrupted" });
    expect(db.followup.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", status: { not: "SENT" } },
      data: { status: "FAILED", error: "interrupted" },
    });
  });

  it("undoes the claim when no Message-ID was written", async () => {
    db.campaignMessage.findMany.mockResolvedValue([mirror({})]);
    await reconcileFollowupMirrors(now);
    expect(db.campaignMessage.updateMany.mock.calls[0][0].data).toMatchObject({ status: "SCHEDULED", sendingAt: null });
    expect(db.followup.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", status: "SENT" },
      data: { status: "GENERATED", sentAt: null, sentVia: null, scheduledFor: now },
    });
  });
});
