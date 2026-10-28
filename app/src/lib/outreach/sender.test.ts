import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const mailboxFindMany = vi.fn();
const mailboxFindUnique = vi.fn();
const mailboxUpdate = vi.fn();
const messageFindMany = vi.fn();
const messageFindUnique = vi.fn();
const messageFindFirst = vi.fn();
const messageUpdateMany = vi.fn();
const messageUpdate = vi.fn();
const messageCreate = vi.fn();
const stepFindMany = vi.fn();
const enrollmentUpdate = vi.fn();
const enrollmentUpdateMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    mailbox: {
      findMany: (...a: unknown[]) => mailboxFindMany(...a),
      findUnique: (...a: unknown[]) => mailboxFindUnique(...a),
      update: (...a: unknown[]) => mailboxUpdate(...a),
    },
    campaignMessage: {
      findMany: (...a: unknown[]) => messageFindMany(...a),
      findUnique: (...a: unknown[]) => messageFindUnique(...a),
      findFirst: (...a: unknown[]) => messageFindFirst(...a),
      updateMany: (...a: unknown[]) => messageUpdateMany(...a),
      update: (...a: unknown[]) => messageUpdate(...a),
      create: (...a: unknown[]) => messageCreate(...a),
    },
    campaignStep: { findMany: (...a: unknown[]) => stepFindMany(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => fn(txStub),
    campaignProspect: {
      update: (...a: unknown[]) => enrollmentUpdate(...a),
      updateMany: (...a: unknown[]) => enrollmentUpdateMany(...a),
    },
  },
}));
const txStub = {
  campaignMessage: { updateMany: (...a: unknown[]) => messageUpdateMany(...a) },
  campaignProspect: { update: (...a: unknown[]) => enrollmentUpdate(...a) },
};
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_DAILY_CAP_MAX: 50 }) }));
vi.mock("@/lib/closing/settings", () => ({
  getWorkspaceSettings: async () => ({
    businessHourStart: 9,
    businessHourEnd: 18,
    businessDays: [1, 2, 3, 4, 5],
    senderSignature: null,
  }),
}));
vi.mock("@/lib/closing/unsubscribe", () => ({
  unsubscribePageUrl: ({ id }: { id: string }) => `https://app.test/u/${id}`,
  unsubscribeOneClickUrl: ({ id }: { id: string }) => `https://app.test/api/unsubscribe/${id}`,
}));
vi.mock("@/lib/mailboxes", () => ({
  connectorFor: vi.fn(),
  generateMessageId: () => "<generated@acme.io>",
  messageIdDomain: () => "acme.io",
}));
const reserveSend = vi.fn();
vi.mock("@/lib/mailboxes/caps/counter", () => ({
  reserveSend: (...a: unknown[]) => {
    calls.push("counter");
    return reserveSend(...a);
  },
}));
const notifyMailboxOwner = vi.fn();
vi.mock("@/lib/mailboxes/notify-owner", () => ({ notifyMailboxOwner: (...a: unknown[]) => notifyMailboxOwner(...a) }));
const isSuppressed = vi.fn();
vi.mock("./suppression", () => ({
  isSuppressed: (...a: unknown[]) => {
    calls.push("suppression");
    return isSuppressed(...a);
  },
}));
const createCampaignLink = vi.fn();
vi.mock("./link", () => ({ createCampaignLink: (...a: unknown[]) => createCampaignLink(...a) }));
const stopEnrollment = vi.fn();
vi.mock("./enroll", () => ({ stopEnrollment: (...a: unknown[]) => stopEnrollment(...a) }));

const { MailboxError } = await import("@/lib/mailboxes/errors");
const { expireStaleLeases, SEND_BUDGET_MS, sendDueMessages, sendTestMessage } = await import("./sender");

const now = new Date("2026-11-18T10:00:00Z"); // Wednesday 11:00 in Paris
const DAY = 86_400_000;
const mailbox = {
  id: "mb1",
  organizationId: "org",
  email: "me@acme.io",
  timezone: "Europe/Paris",
  rampStartedAt: new Date("2026-01-01T00:00:00Z"),
  dailyCap: 30,
  sentDay: null,
  sentCount: 0,
  signature: null as string | null,
  status: "ACTIVE",
};
const step1 = { id: "s1", order: 1, delayDays: 0, subject: "Hello {{firstName|there}}", newThread: false, body: "Hi {{firstName}}", carriesLink: false };
const step2 = { id: "s2", order: 2, delayDays: 3, subject: null, newThread: false, body: "Any news?", carriesLink: false };
const enrollment = {
  id: "e1",
  campaignId: "c1",
  organizationId: "org",
  email: "paul@acme.com",
  firstName: "Paul",
  lastName: "Martin",
  company: "Acme",
  title: null,
  vars: null,
  timezone: "Europe/Paris",
  locale: "fr",
  status: "ACTIVE",
  currentStep: 0,
  threadSubject: null as string | null,
  firstMessageId: null as string | null,
  providerThreadId: null as string | null,
  linkId: null,
};
const message = (extra: object = {}) => ({
  id: "m1",
  status: "SENDING",
  campaignId: "c1",
  enrollmentId: "e1",
  mailboxId: "mb1",
  stepId: "s1",
  dedupeKey: "cold:e1:s1",
  attempts: 1,
  enrollment,
  campaign: { status: "ACTIVE", documentId: null, createdById: "u1" },
  ...extra,
});

const send = vi.fn();
const connector = { capabilities: { listUnsubscribe: true } as const, send: (...a: unknown[]) => send(...a) };
const deps = { connector: () => connector as never };

let candidates: { id: string; attempts?: number }[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now); // the lease is stamped with the real clock
  vi.clearAllMocks();
  calls.length = 0;
  candidates = [{ id: "m1" }];
  mailboxFindMany.mockResolvedValue([mailbox]);
  mailboxFindUnique.mockResolvedValue({ status: "ACTIVE" });
  messageFindMany.mockImplementation(async () => candidates);
  messageUpdateMany.mockImplementation(async (args: { data: { status?: string } }) => {
    if (args.data.status === "SENDING") calls.push("reserve");
    else if ("messageId" in args.data && !("status" in args.data)) calls.push("mark");
    return { count: 1 };
  });
  messageFindUnique.mockResolvedValue(message());
  messageFindFirst.mockResolvedValue(null);
  messageUpdate.mockResolvedValue({});
  messageCreate.mockResolvedValue({ id: "m2" });
  stepFindMany.mockResolvedValue([step1, step2]);
  enrollmentUpdate.mockResolvedValue({});
  enrollmentUpdateMany.mockResolvedValue({ count: 1 });
  isSuppressed.mockResolvedValue(false);
  reserveSend.mockResolvedValue(true);
  stopEnrollment.mockResolvedValue(true);
  send.mockImplementation(async () => {
    calls.push("send");
    return { messageId: "<sent@acme.io>", providerId: "p1", threadId: "t1" };
  });
});

describe("sendDueMessages, success", () => {
  it("reserves, re-checks, counts, then sends, then records and plans the next step", async () => {
    const result = await sendDueMessages(now, {}, deps);

    expect(calls).toEqual(["reserve", "suppression", "counter", "mark", "send"]);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SCHEDULED" },
      data: { status: "SENDING", sendingAt: now, attempts: { increment: 1 } },
    });
    expect(reserveSend).toHaveBeenCalledWith("mb1", "2026-11-18", 30);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { messageId: "<generated@acme.io>" },
    });

    const sent = send.mock.calls[0][0];
    expect(sent).toMatchObject({
      to: { address: "paul@acme.com", name: "Paul Martin" },
      subject: "Hello Paul",
      inReplyTo: null,
      references: [],
      idempotencyKey: "cold:e1:s1",
      messageId: "<generated@acme.io>",
      headers: {
        "List-Unsubscribe": "<https://app.test/api/unsubscribe/e1>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    expect(sent.text).toContain("https://app.test/u/e1");
    expect(sent.html).toContain("https://app.test/u/e1");

    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: expect.objectContaining({
        status: "SENT",
        sentAt: now,
        messageId: "<sent@acme.io>",
        providerMessageId: "p1",
        threadId: "t1",
        subject: "Hello Paul",
        body: "Hi Paul",
        inReplyTo: null,
        carriesLink: false,
      }),
    });
    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: {
        currentStep: 1,
        threadSubject: "Hello Paul",
        firstMessageId: "<sent@acme.io>",
        providerThreadId: "t1",
      },
    });
    const next = messageCreate.mock.calls[0][0].data;
    expect(next).toMatchObject({ stepId: "s2", dedupeKey: "cold:e1:s2", status: "SCHEDULED", subject: "Re: Hello Paul" });
    expect(next.scheduledFor.getTime()).toBeGreaterThanOrEqual(now.getTime() + 3 * DAY);
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { nextSendAt: next.scheduledFor },
    });
    expect(result).toEqual({ sent: 1, rescheduled: 0, failed: 0, cancelled: 0 });
  });

  it("answers in the thread of the previous mail", async () => {
    const thread = { ...enrollment, currentStep: 1, threadSubject: "Hello Paul", firstMessageId: "<first@acme.io>", providerThreadId: "t1" };
    messageFindUnique.mockResolvedValue(message({ stepId: "s2", dedupeKey: "cold:e1:s2", enrollment: thread }));
    messageFindFirst.mockResolvedValue({ messageId: "<first@acme.io>", sentAt: new Date(now.getTime() - 3 * DAY) });

    await sendDueMessages(now, {}, deps);

    expect(send.mock.calls[0][0]).toMatchObject({
      subject: "Re: Hello Paul",
      inReplyTo: "<first@acme.io>",
      references: ["<first@acme.io>"],
    });
    // Last step: nothing to plan, the end is noticed by planEnrollments
    expect(messageCreate).not.toHaveBeenCalled();
    expect(enrollmentUpdateMany).toHaveBeenLastCalledWith({ where: { id: "e1", status: "ACTIVE" }, data: { nextSendAt: null } });
  });

  it("appends the signature before the unsubscribe footer", async () => {
    mailboxFindMany.mockResolvedValue([{ ...mailbox, signature: "Jerome" }]);
    await sendDueMessages(now, {}, deps);
    const sent = send.mock.calls[0][0];
    expect(sent.text.indexOf("Hi Paul\n\nJerome")).toBe(0);
    expect(sent.text.indexOf("https://app.test/u/e1")).toBeGreaterThan(sent.text.indexOf("Jerome"));
    const sentWrite = messageUpdateMany.mock.calls.find(([a]) => a.data.status === "SENT")![0];
    expect(sentWrite.data.body).toBe("Hi Paul\n\nJerome");
  });
});

describe("sendDueMessages, re-checks", () => {
  it("does nothing when the reservation is lost", async () => {
    messageUpdateMany.mockResolvedValue({ count: 0 });
    const result = await sendDueMessages(now, {}, deps);
    expect(messageFindUnique).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, rescheduled: 0, failed: 0, cancelled: 0 });
  });

  it("puts the message back outside the prospect's business hours, without sending", async () => {
    const night = new Date("2026-11-18T22:00:00Z");
    vi.setSystemTime(night);
    const result = await sendDueMessages(night, {}, deps);
    expect(send).not.toHaveBeenCalled();
    expect(reserveSend).not.toHaveBeenCalled();
    const call = messageUpdateMany.mock.calls.find(([a]) => a.data.status === "SCHEDULED")![0];
    expect(call.where).toEqual({ id: "m1", status: "SENDING", sendingAt: night });
    expect(call.data).toMatchObject({ status: "SCHEDULED", sendingAt: null, messageId: null, attempts: { decrement: 1 } });
    expect(call.data.scheduledFor.getTime()).toBeGreaterThan(night.getTime());
    expect(result.rescheduled).toBe(1);
  });

  it("cancels when the enrollment is no longer active", async () => {
    messageFindUnique.mockResolvedValue(message({ enrollment: { ...enrollment, status: "REPLIED" } }));
    const result = await sendDueMessages(now, {}, deps);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "CANCELLED", sendingAt: null },
    });
    expect(send).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("cancels when the step was removed", async () => {
    stepFindMany.mockResolvedValue([step2]);
    const result = await sendDueMessages(now, {}, deps);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "CANCELLED", sendingAt: null, error: "step_removed" },
    });
    expect(result.cancelled).toBe(1);
  });

  it("leaves the schedule alone when the campaign is paused", async () => {
    messageFindUnique.mockResolvedValue(message({ campaign: { status: "PAUSED", documentId: null, createdById: "u1" } }));
    await sendDueMessages(now, {}, deps);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "SCHEDULED", sendingAt: null, messageId: null, attempts: { decrement: 1 } },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("stops a suppressed address", async () => {
    isSuppressed.mockResolvedValue(true);
    const result = await sendDueMessages(now, {}, deps);
    expect(isSuppressed).toHaveBeenCalledWith("org", "paul@acme.com");
    expect(stopEnrollment).toHaveBeenCalledWith("e1", "SUPPRESSED", "suppressed", now);
    expect(send).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("stops the enrollment on a missing variable", async () => {
    messageFindUnique.mockResolvedValue(message({ enrollment: { ...enrollment, firstName: null } }));
    stepFindMany.mockResolvedValue([{ ...step1, subject: "Hello", body: "Hi {{firstName}}" }, step2]);
    const result = await sendDueMessages(now, {}, deps);
    expect(stopEnrollment).toHaveBeenCalledWith("e1", "SUPPRESSED", "missing_variable:firstName", now);
    expect(reserveSend).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(1);
  });

  it("fails the message and pauses the enrollment when the plan refuses the link", async () => {
    const { PlanLimitError } = await import("@/lib/billing/workspace-plan");
    stepFindMany.mockResolvedValue([{ ...step1, carriesLink: true, body: "See {{link}}" }, step2]);
    createCampaignLink.mockRejectedValue(new PlanLimitError("links" as never));
    const result = await sendDueMessages(now, {}, deps);
    expect(createCampaignLink).toHaveBeenCalledWith("e1", { owned: true, now });
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "FAILED", error: "plan_limit", sendingAt: null },
    });
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "plan_limit", pausedAt: now },
    });
    expect(send).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it("sends the Clozer link of a link step", async () => {
    stepFindMany.mockResolvedValue([{ ...step1, carriesLink: true, body: "See {{link}}" }, step2]);
    createCampaignLink.mockResolvedValue({ linkId: "l1", prospectId: null, url: "https://app.test/v/acme-abc", title: "Devis" });
    await sendDueMessages(now, {}, deps);
    expect(send.mock.calls[0][0].text).toContain("See https://app.test/v/acme-abc");
    expect(send.mock.calls[0][0].html).toContain('<a href="https://app.test/v/acme-abc">Devis</a>');
    expect(messageUpdateMany.mock.calls.find(([a]) => a.data.status === "SENT")![0].data.carriesLink).toBe(true);
  });
});

describe("sendDueMessages, daily cap", () => {
  it("moves the message to tomorrow and stops the mailbox when the day is full", async () => {
    candidates = [{ id: "m1" }, { id: "m2" }];
    reserveSend.mockResolvedValue(false);
    const result = await sendDueMessages(now, {}, deps);

    expect(send).not.toHaveBeenCalled();
    expect(messageFindUnique).toHaveBeenCalledTimes(1); // the second candidate is not even reserved
    const call = messageUpdateMany.mock.calls.find(([a]) => a.data.status === "SCHEDULED")![0];
    expect(call.where).toEqual({ id: "m1", status: "SENDING", sendingAt: now });
    // Tomorrow, Thursday 19 Nov, inside the opening hours (Paris, UTC+1)
    expect(call.data.scheduledFor.getTime()).toBeGreaterThanOrEqual(new Date("2026-11-19T08:00:00Z").getTime());
    expect(call.data.scheduledFor.getTime()).toBeLessThan(new Date("2026-11-19T17:00:00Z").getTime());
    expect(result.rescheduled).toBe(1);
  });

  it("skips a mailbox with no allowance left", async () => {
    mailboxFindMany.mockResolvedValue([{ ...mailbox, sentDay: "2026-11-18", sentCount: 30 }]);
    await sendDueMessages(now, {}, deps);
    expect(messageFindMany).not.toHaveBeenCalled();
  });
});

describe("sendDueMessages, send errors", () => {
  it("AUTH_REVOKED: mailbox in ERROR, message back in the queue, owner told, mailbox stopped", async () => {
    candidates = [{ id: "m1" }, { id: "m2" }];
    send.mockRejectedValue(new MailboxError("AUTH_REVOKED", "token revoked"));
    const result = await sendDueMessages(now, {}, deps);

    expect(mailboxUpdate).toHaveBeenCalledWith({
      where: { id: "mb1" },
      data: { status: "ERROR", lastError: "AUTH_REVOKED: token revoked", lastErrorAt: now },
    });
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "SCHEDULED", sendingAt: null, messageId: null, attempts: { decrement: 1 } },
    });
    expect(notifyMailboxOwner).toHaveBeenCalledWith("mb1", "auth_revoked", "token revoked", now);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 0, rescheduled: 0, failed: 0, cancelled: 0 });
  });

  it("RATE_LIMITED: waits for retryAfterMs and stops the mailbox", async () => {
    candidates = [{ id: "m1" }, { id: "m2" }];
    send.mockRejectedValue(new MailboxError("RATE_LIMITED", "slow down", { retryAfterMs: 600_000 }));
    const result = await sendDueMessages(now, {}, deps);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: {
        status: "SCHEDULED",
        sendingAt: null,
        messageId: null,
        attempts: { decrement: 1 },
        scheduledFor: new Date(now.getTime() + 600_000),
      },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.rescheduled).toBe(1);
  });

  it("REJECTED: message FAILED with the SMTP line, enrollment PAUSED, next message goes on", async () => {
    send.mockRejectedValue(new MailboxError("REJECTED", "550 no such user"));
    const result = await sendDueMessages(now, {}, deps);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "FAILED", error: "550 no such user", sendingAt: null },
    });
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "rejected", pausedAt: now },
    });
    expect(result.failed).toBe(1);
    expect(enrollmentUpdate).not.toHaveBeenCalled();
  });

  it("TRANSIENT: tried again in 30 minutes while attempts remain", async () => {
    send.mockRejectedValue(new MailboxError("TRANSIENT", "timeout"));
    const result = await sendDueMessages(now, {}, deps);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "SCHEDULED", sendingAt: null, messageId: null, scheduledFor: new Date(now.getTime() + 30 * 60_000) },
    });
    expect(result.rescheduled).toBe(1);
  });

  it("TRANSIENT on the last attempt: FAILED, enrollment PAUSED, owner told", async () => {
    messageFindUnique.mockResolvedValue(message({ attempts: 3 }));
    send.mockRejectedValue(new Error("boom"));
    const result = await sendDueMessages(now, {}, deps);
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "FAILED", error: "boom", sendingAt: null },
    });
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "send_failed", pausedAt: now },
    });
    expect(notifyMailboxOwner).toHaveBeenCalledWith("mb1", "send_failed", "boom", now);
    expect(result.failed).toBe(1);
  });
});

describe("expireStaleLeases", () => {
  const cutoff = new Date(now.getTime() - 5 * 60_000);
  const stale = { status: "SENDING", sendingAt: { lt: cutoff } };

  it("fails a stale row that has a Message-ID and pauses its enrollment, whatever the attempts", async () => {
    messageFindMany.mockResolvedValueOnce([{ id: "m1", enrollmentId: "e1" }]).mockResolvedValueOnce([]);
    messageUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const result = await expireStaleLeases(now);

    expect(messageFindMany).toHaveBeenNthCalledWith(1, {
      where: { ...stale, messageId: { not: null } },
      select: { id: true, enrollmentId: true },
    });
    expect(messageUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { ...stale, id: { in: ["m1"] } },
      data: { status: "FAILED", error: "interrupted", sendingAt: null },
    });
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1"] }, status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "interrupted", pausedAt: now },
    });
    expect(result).toEqual({ requeued: 0, failed: 1 });
  });

  it("requeues a stale row that never reached the connector, fails it once the attempts are used up", async () => {
    messageFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "m2", enrollmentId: "e2" }]);
    messageUpdateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 1 });
    const result = await expireStaleLeases(now);

    expect(messageUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { ...stale, messageId: null, attempts: { lt: 3 } },
      data: { status: "SCHEDULED", sendingAt: null },
    });
    expect(messageFindMany).toHaveBeenNthCalledWith(2, {
      where: { ...stale, messageId: null, attempts: { gte: 3 } },
      select: { id: true, enrollmentId: true },
    });
    expect(enrollmentUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e2"] }, status: "ACTIVE" },
      data: { status: "PAUSED", pausedReason: "interrupted", pausedAt: now },
    });
    expect(result).toEqual({ requeued: 2, failed: 1 });
  });
});

describe("sendDueMessages, leases and failures", () => {
  it("does not touch the row when the lease was taken over before the send is recorded", async () => {
    messageUpdateMany.mockImplementation(async (args: { data: { status?: string } }) => ({
      count: args.data.status === "SENT" ? 0 : 1,
    }));
    const result = await sendDueMessages(now, {}, deps);
    expect(send).toHaveBeenCalledTimes(1);
    expect(enrollmentUpdate).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it("does not send when the Message-ID marker cannot be written under the lease", async () => {
    messageUpdateMany.mockImplementation(async (args: { data: { messageId?: string; status?: string } }) => ({
      count: args.data.messageId && !args.data.status ? 0 : 1,
    }));
    await sendDueMessages(now, {}, deps);
    expect(send).not.toHaveBeenCalled();
  });

  it("plans no next message when the enrollment was stopped during the send", async () => {
    enrollmentUpdateMany.mockResolvedValue({ count: 0 });
    await sendDueMessages(now, {}, deps);
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("stops taking new messages once the budget is spent", async () => {
    candidates = [{ id: "m1" }, { id: "m2" }];
    send.mockImplementation(async () => {
      vi.setSystemTime(new Date(now.getTime() + SEND_BUDGET_MS + 1000));
      return { messageId: "<sent@acme.io>", providerId: null, threadId: null };
    });
    const result = await sendDueMessages(now, {}, deps);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
  });

  it("requeues an unexpected error before the send and carries on with the next message", async () => {
    candidates = [
      { id: "m1", attempts: 0 },
      { id: "m2", attempts: 0 },
    ];
    messageFindUnique.mockRejectedValueOnce(new Error("db down")).mockResolvedValue(message({ id: "m2" }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendDueMessages(now, {}, deps);
    spy.mockRestore();
    expect(messageUpdateMany).toHaveBeenCalledWith({
      where: { id: "m1", status: "SENDING", sendingAt: now },
      data: { status: "SCHEDULED", sendingAt: null, scheduledFor: new Date(now.getTime() + 30 * 60_000) },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(result.rescheduled).toBe(1);
  });

  it("leaves a row SENDING when something breaks after the Message-ID was written", async () => {
    enrollmentUpdate.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendDueMessages(now, {}, deps);
    spy.mockRestore();
    expect(messageUpdateMany.mock.calls.filter(([a]) => a.data.status === "SCHEDULED")).toHaveLength(0);
  });
});

describe("sendTestMessage", () => {
  const campaign = {
    id: "c1",
    locale: "fr",
    mailbox,
    steps: [step1, step2],
    enrollments: [],
  };
  const campaignFindFirst = vi.fn();
  beforeEach(async () => {
    const { prisma } = await import("@/lib/db");
    (prisma as unknown as { campaign: unknown }).campaign = { findFirst: (...a: unknown[]) => campaignFindFirst(...a) };
    campaignFindFirst.mockResolvedValue(campaign);
  });

  it("sends a prefixed test with sample variables, no footer, and stores nothing", async () => {
    const result = await sendTestMessage({ organizationId: "org", campaignId: "c1", stepOrder: 1, to: "me@x.io", now }, deps);
    expect(result).toEqual({ ok: true });
    expect(reserveSend).toHaveBeenCalledWith("mb1", "2026-11-18", 30);
    const sent = send.mock.calls[0][0];
    expect(sent).toMatchObject({ to: { address: "me@x.io" }, subject: "[Test] Hello Marie" });
    expect(sent.text).toBe("Hi Marie");
    expect(messageCreate).not.toHaveBeenCalled();
    expect(messageUpdate).not.toHaveBeenCalled();
  });

  it("reports a full day as cap", async () => {
    reserveSend.mockResolvedValue(false);
    expect(await sendTestMessage({ organizationId: "org", campaignId: "c1", stepOrder: 1, to: "me@x.io", now }, deps)).toEqual({
      ok: false,
      code: "cap",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a missing mailbox, a missing step and a connector error", async () => {
    campaignFindFirst.mockResolvedValueOnce({ ...campaign, mailbox: { ...mailbox, status: "ERROR" } });
    expect(await sendTestMessage({ organizationId: "org", campaignId: "c1", stepOrder: 1, to: "a@b.io", now }, deps)).toEqual({
      ok: false,
      code: "no_mailbox",
    });
    expect(await sendTestMessage({ organizationId: "org", campaignId: "c1", stepOrder: 9, to: "a@b.io", now }, deps)).toEqual({
      ok: false,
      code: "not_found",
    });
    send.mockRejectedValue(new MailboxError("AUTH_REVOKED", "no"));
    expect(await sendTestMessage({ organizationId: "org", campaignId: "c1", stepOrder: 1, to: "a@b.io", now }, deps)).toEqual({
      ok: false,
      code: "AUTH_REVOKED",
    });
  });
});
