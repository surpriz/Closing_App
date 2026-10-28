import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InboundMessage } from "../types";

const prisma = {
  mailboxInboundEvent: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  campaignMessage: { updateMany: vi.fn(), update: vi.fn() },
  campaignProspect: { findUnique: vi.fn() },
  prospect: { updateMany: vi.fn() },
  mailbox: { update: vi.fn() },
};
vi.mock("@/lib/db", () => ({ prisma }));

const stopEnrollment = vi.fn();
vi.mock("@/lib/outreach/enroll", () => ({ stopEnrollment: (...a: unknown[]) => stopEnrollment(...a) }));
const pauseCampaignsOfMailbox = vi.fn();
vi.mock("@/lib/outreach/campaigns", () => ({ pauseCampaignsOfMailbox: (...a: unknown[]) => pauseCampaignsOfMailbox(...a) }));
const createCampaignLink = vi.fn();
vi.mock("@/lib/outreach/link", () => ({ createCampaignLink: (...a: unknown[]) => createCampaignLink(...a) }));
const releaseCampaignLink = vi.fn();
vi.mock("@/lib/outreach/ownership", () => ({ releaseCampaignLink: (...a: unknown[]) => releaseCampaignLink(...a) }));
const addSuppression = vi.fn();
vi.mock("@/lib/outreach/suppression", () => ({ addSuppression: (...a: unknown[]) => addSuppression(...a) }));
const recordProspectReply = vi.fn();
vi.mock("@/lib/closing/replies/record", () => ({ recordProspectReply: (...a: unknown[]) => recordProspectReply(...a) }));
const notifySeller = vi.fn();
vi.mock("@/lib/closing/notify/notify", () => ({ notifySeller: (...a: unknown[]) => notifySeller(...a) }));
const notifyMailboxOwner = vi.fn();
vi.mock("../notify-owner", () => ({ notifyMailboxOwner: (...a: unknown[]) => notifyMailboxOwner(...a) }));

const { handleInbound } = await import("./handle");

const NOW = new Date("2026-10-28T10:00:00Z");
const mailbox = () => ({
  id: "mb1",
  organizationId: "org1",
  email: "seller@acme.com",
  timezone: "Europe/Paris",
  policyBounceDay: null as string | null,
  policyBounceCount: 0,
});
const ctx = {
  mailboxAddress: "seller@acme.com",
  teamEmails: [],
  sentMessageIds: new Map([["sent1@acme.com", { enrollmentId: "en1", messageId: "cm1" }]]),
  enrollments: [{ enrollmentId: "en1", email: "bob@target.io", lastSentAt: new Date("2026-10-27T10:00:00Z") }],
  now: NOW,
};

function message(over: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: "m1",
    messageId: "<in1@target.io>",
    inReplyTo: "<sent1@acme.com>",
    references: [],
    from: { address: "bob@target.io", name: "Bob" },
    to: ["seller@acme.com"],
    subject: "Re: hello",
    date: new Date("2026-10-28T09:00:00Z"),
    textExcerpt: "x".repeat(900),
    isDsn: false,
    dsn: null,
    headers: {},
    threadId: null,
    ...over,
  };
}
const dsnMessage = (dsn: Partial<NonNullable<InboundMessage["dsn"]>>) =>
  message({
    from: { address: "mailer-daemon@target.io", name: null },
    isDsn: true,
    dsn: {
      action: "failed",
      status: "5.1.1",
      diagnostic: "user unknown",
      failedRecipient: "bob@target.io",
      originalMessageId: "<sent1@acme.com>",
      ...dsn,
    },
  });

beforeEach(() => {
  vi.resetAllMocks();
  prisma.mailboxInboundEvent.create.mockResolvedValue({ id: "ev1" });
  prisma.mailboxInboundEvent.delete.mockResolvedValue({});
  prisma.campaignProspect.findUnique.mockResolvedValue({
    email: "bob@target.io",
    linkId: null,
    prospectId: null,
    campaign: { documentId: "doc1" },
  });
  createCampaignLink.mockResolvedValue({ linkId: "l1", prospectId: "p1" });
});

describe("handleInbound", () => {
  it("records the event first and reports a duplicate key without any effect", async () => {
    prisma.mailboxInboundEvent.create.mockRejectedValue({ code: "P2002" });
    expect(await handleInbound(mailbox(), message(), ctx, NOW)).toBe("duplicate");
    expect(prisma.mailboxInboundEvent.create).toHaveBeenCalledWith({
      data: { mailboxId: "mb1", externalKey: "mailbox:mb1:m1", kind: "IGNORED", receivedAt: message().date },
      select: { id: true },
    });
    expect(stopEnrollment).not.toHaveBeenCalled();
    expect(prisma.mailboxInboundEvent.update).not.toHaveBeenCalled();
  });

  it("keeps nothing but the key for a message that is not ours", async () => {
    expect(await handleInbound(mailbox(), message({ from: { address: "x@other.io", name: null }, inReplyTo: null }), ctx, NOW)).toBe(
      "ignored",
    );
    expect(prisma.mailboxInboundEvent.update).not.toHaveBeenCalled();
    expect(stopEnrollment).not.toHaveBeenCalled();
  });

  it("stops the enrollment, creates a non-owned link and logs the reply with a short excerpt", async () => {
    const order: string[] = [];
    stopEnrollment.mockImplementation(async () => void order.push("stop"));
    createCampaignLink.mockImplementation(async () => (order.push("link"), { linkId: "l1", prospectId: "p1" }));
    recordProspectReply.mockImplementation(async () => void order.push("record"));
    releaseCampaignLink.mockImplementation(async () => void order.push("release"));

    expect(await handleInbound(mailbox(), message(), ctx, NOW)).toBe("reply");

    expect(order).toEqual(["stop", "link", "record", "release"]);
    expect(stopEnrollment).toHaveBeenCalledWith("en1", "REPLIED", null, NOW);
    expect(prisma.campaignMessage.updateMany).toHaveBeenCalledWith({
      where: { id: "cm1" },
      data: { repliedAt: message().date },
    });
    expect(createCampaignLink).toHaveBeenCalledWith("en1", { owned: false, now: NOW });
    const reply = recordProspectReply.mock.calls[0][0];
    expect(reply).toMatchObject({
      linkId: "l1",
      prospectId: "p1",
      followupId: null,
      fromEmail: "bob@target.io",
      fromName: "Bob",
      source: "MAILBOX",
      externalKey: "mbx:mb1:m1",
    });
    expect(reply.excerpt.length).toBeLessThanOrEqual(600);
    expect(releaseCampaignLink).toHaveBeenCalledWith("l1");
    expect(prisma.mailboxInboundEvent.update).toHaveBeenCalledWith({
      where: { id: "ev1" },
      data: expect.objectContaining({
        kind: "REPLY",
        fromEmail: "bob@target.io",
        enrollmentId: "en1",
        matchedMessageId: "cm1",
        inReplyTo: "<sent1@acme.com>",
      }),
    });
  });

  it("reuses the existing link instead of creating one", async () => {
    prisma.campaignProspect.findUnique.mockResolvedValue({ linkId: "l9", prospectId: "p9", campaign: { documentId: "d" } });
    await handleInbound(mailbox(), message(), ctx, NOW);
    expect(createCampaignLink).not.toHaveBeenCalled();
    expect(recordProspectReply.mock.calls[0][0]).toMatchObject({ linkId: "l9", prospectId: "p9" });
  });

  it("still ends the sequence when the plan has no room for the link", async () => {
    const { PlanLimitError } = await import("@/lib/billing/workspace-plan");
    createCampaignLink.mockRejectedValue(new PlanLimitError("links" as never));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await handleInbound(mailbox(), message(), ctx, NOW)).toBe("reply");
    expect(stopEnrollment).toHaveBeenCalled();
    expect(recordProspectReply).not.toHaveBeenCalled();
  });

  it("removes the event again when an effect fails so the message can be retried", async () => {
    stopEnrollment.mockRejectedValue(new Error("db down"));
    await expect(handleInbound(mailbox(), message(), ctx, NOW)).rejects.toThrow("db down");
    expect(prisma.mailboxInboundEvent.delete).toHaveBeenCalledWith({ where: { id: "ev1" } });
  });

  it("a permanent bounce ends the enrollment, suppresses the address and warns the seller when a link exists", async () => {
    prisma.campaignProspect.findUnique.mockResolvedValue({ email: "bob@target.io", linkId: "l1" });
    expect(await handleInbound(mailbox(), dsnMessage({}), ctx, NOW)).toBe("bounce");
    expect(prisma.campaignMessage.update).toHaveBeenCalledWith({
      where: { id: "cm1" },
      data: { bouncedAt: NOW, bounceDetail: "user unknown" },
    });
    expect(stopEnrollment).toHaveBeenCalledWith("en1", "BOUNCED", "5.1.1", NOW);
    expect(addSuppression).toHaveBeenCalledWith({
      organizationId: "org1",
      email: "bob@target.io",
      reason: "BOUNCE",
      source: "mailbox_sync",
      detail: "5.1.1 user unknown",
    });
    expect(prisma.prospect.updateMany).toHaveBeenCalledWith({
      where: { link: { organizationId: "org1" }, email: { equals: "bob@target.io", mode: "insensitive" }, bouncedAt: null },
      data: { bouncedAt: NOW, bounceDetail: "user unknown" },
    });
    expect(notifySeller).toHaveBeenCalledWith({
      linkId: "l1",
      type: "EMAIL_BOUNCED",
      dedupeKey: "email_bounced:cold:en1",
      payload: { prospectEmail: "bob@target.io", detail: "user unknown" },
      now: NOW,
    });
    expect(prisma.mailboxInboundEvent.update).toHaveBeenCalledWith({
      where: { id: "ev1" },
      data: expect.objectContaining({ kind: "BOUNCE", enrollmentId: "en1", dsnStatus: "5.1.1", dsnClass: "permanent" }),
    });
  });

  it("a permanent bounce without a link neither touches prospects nor notifies", async () => {
    prisma.campaignProspect.findUnique.mockResolvedValue({ email: "bob@target.io", linkId: null });
    expect(await handleInbound(mailbox(), dsnMessage({ originalMessageId: null }), ctx, NOW)).toBe("bounce");
    expect(stopEnrollment).toHaveBeenCalledWith("en1", "BOUNCED", "5.1.1", NOW);
    expect(prisma.campaignMessage.update).not.toHaveBeenCalled();
    expect(addSuppression).toHaveBeenCalled();
    expect(prisma.prospect.updateMany).not.toHaveBeenCalled();
    expect(notifySeller).not.toHaveBeenCalled();
  });

  it("a refused message marks that message only", async () => {
    expect(await handleInbound(mailbox(), dsnMessage({ status: "5.2.3", diagnostic: "too large" }), ctx, NOW)).toBe("bounce");
    expect(prisma.campaignMessage.update).toHaveBeenCalledWith({
      where: { id: "cm1" },
      data: { bouncedAt: NOW, bounceDetail: "too large" },
    });
    expect(stopEnrollment).not.toHaveBeenCalled();
    expect(addSuppression).not.toHaveBeenCalled();
  });

  it("a transient bounce only leaves the event", async () => {
    expect(await handleInbound(mailbox(), dsnMessage({ status: "4.2.2", diagnostic: "mailbox full" }), ctx, NOW)).toBe(
      "bounce_transient",
    );
    expect(stopEnrollment).not.toHaveBeenCalled();
    expect(prisma.campaignMessage.update).not.toHaveBeenCalled();
    expect(prisma.mailboxInboundEvent.update).toHaveBeenCalledWith({
      where: { id: "ev1" },
      data: expect.objectContaining({ kind: "BOUNCE", enrollmentId: "en1", dsnClass: "transient" }),
    });
  });

  it("a bounce whose target is unknown is stored without an enrollment", async () => {
    const effect = await handleInbound(
      mailbox(),
      dsnMessage({ originalMessageId: "<unknown@x>", failedRecipient: "ghost@nowhere.io" }),
      ctx,
      NOW,
    );
    expect(effect).toBe("bounce_transient");
    expect(stopEnrollment).not.toHaveBeenCalled();
    expect(prisma.mailboxInboundEvent.update).toHaveBeenCalledWith({
      where: { id: "ev1" },
      data: expect.objectContaining({ kind: "BOUNCE", enrollmentId: null }),
    });
  });

  it("pauses the campaigns and warns the owner on the 3rd policy bounce of the local day", async () => {
    const mb = mailbox();
    const policy = dsnMessage({ status: "5.7.1", diagnostic: "blocked by spam policy" });

    expect(await handleInbound(mb, { ...policy, id: "a" }, ctx, NOW)).toBe("bounce_policy");
    expect(prisma.mailbox.update).toHaveBeenLastCalledWith({
      where: { id: "mb1" },
      data: { policyBounceDay: "2026-10-28", policyBounceCount: 1 },
    });
    await handleInbound(mb, { ...policy, id: "b" }, ctx, NOW);
    expect(pauseCampaignsOfMailbox).not.toHaveBeenCalled();

    await handleInbound(mb, { ...policy, id: "c" }, ctx, NOW);
    expect(prisma.mailbox.update).toHaveBeenLastCalledWith({
      where: { id: "mb1" },
      data: { policyBounceDay: "2026-10-28", policyBounceCount: 3 },
    });
    expect(pauseCampaignsOfMailbox).toHaveBeenCalledWith("mb1", NOW);
    expect(notifyMailboxOwner).toHaveBeenCalledWith("mb1", "policy_bounces", "blocked by spam policy", NOW);
    expect(stopEnrollment).not.toHaveBeenCalled();
  });

  it("restarts the policy counter when the local day changes", async () => {
    const mb = { ...mailbox(), policyBounceDay: "2026-10-27", policyBounceCount: 2 };
    await handleInbound(mb, dsnMessage({ status: "5.7.1" }), ctx, NOW);
    expect(prisma.mailbox.update).toHaveBeenCalledWith({
      where: { id: "mb1" },
      data: { policyBounceDay: "2026-10-28", policyBounceCount: 1 },
    });
    expect(pauseCampaignsOfMailbox).not.toHaveBeenCalled();
  });
});
