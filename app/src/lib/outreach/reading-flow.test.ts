import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End to end, on an in-memory database: a step with the link went out, the prospect lingers on the pricing, the
 * enrollment pauses with an alert and a COLD_READ_PRICING draft, the seller approves it, the campaign mailbox sends it
 * in the thread, the enrollment goes on and its next step is planned from that send.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const store = vi.hoisted(() => ({
  links: [] as Row[],
  enrollments: [] as Row[],
  campaigns: [] as Row[],
  steps: [] as Row[],
  messages: [] as Row[],
  followups: [] as Row[],
  prospects: [] as Row[],
  views: [] as Row[],
  mailboxes: [] as Row[],
  sent: [] as Row[],
}));

const db = vi.hoisted(() => {
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !(v instanceof Date);
  const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);
  const matchValue = (value: unknown, cond: unknown): boolean => {
    if (!isObject(cond)) return same(value ?? null, cond);
    return Object.entries(cond).every(([op, arg]) => {
      if (op === "in") return (arg as unknown[]).some((v) => same(value, v));
      if (op === "not") return arg === null ? value != null : !matchValue(value, arg);
      const t = (value as Date | null)?.getTime?.();
      const a = (arg as Date).getTime();
      if (t === undefined) return false;
      if (op === "lt") return t < a;
      if (op === "lte") return t <= a;
      if (op === "gt") return t > a;
      if (op === "gte") return t >= a;
      throw new Error(`op ${op}`);
    });
  };
  const matches = (row: Row, where: Where = {}): boolean =>
    Object.entries(where).every(([key, cond]) =>
      key === "OR" ? (cond as Where[]).some((branch) => matches(row, branch)) : matchValue(row[key], cond),
    );
  const apply = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      if (isObject(value) && "increment" in value) row[key] = (row[key] as number) + (value.increment as number);
      else if (isObject(value) && "decrement" in value) row[key] = (row[key] as number) - (value.decrement as number);
      else row[key] = value;
    }
  };
  const table = (rows: () => Row[]) => ({
    updateMany: async ({ where, data }: { where: Where; data: Row }) => {
      const hit = rows().filter((row) => matches(row, where));
      hit.forEach((row) => apply(row, data));
      return { count: hit.length };
    },
    findMany: async ({ where }: { where?: Where } = {}) => rows().filter((row) => matches(row, where)),
    count: async ({ where }: { where?: Where } = {}) => rows().filter((row) => matches(row, where)).length,
  });

  const campaignOf = (id: unknown) => {
    const campaign = store.campaigns.find((c) => c.id === id)!;
    return {
      ...campaign,
      mailbox: store.mailboxes.find((m) => m.id === campaign.mailboxId) ?? null,
      steps: store.steps.filter((s) => s.campaignId === id).sort((a, b) => (a.order as number) - (b.order as number)),
    };
  };
  const enrollmentOf = (id: unknown) => {
    const enrollment = store.enrollments.find((e) => e.id === id);
    return enrollment ? { ...enrollment, campaign: campaignOf(enrollment.campaignId) } : null;
  };
  const linkOf = (id: unknown) => store.links.find((l) => l.id === id)!;

  let ids = 0;
  const client = {
    link: {
      findUnique: async ({ where }: { where: Where }) => linkOf(where.id) ?? null,
    },
    campaignProspect: {
      ...table(() => store.enrollments),
      findUnique: async ({ where }: { where: Where }) => enrollmentOf(where.id),
    },
    documentView: table(() => store.views),
    linkForward: { findMany: async () => [] },
    prospect: {
      findFirst: async ({ where }: { where: Where }) => store.prospects.find((p) => matches(p, where)) ?? null,
    },
    followup: {
      ...table(() => store.followups),
      // Always the full join: each caller only reads what it selected
      findUnique: async ({ where }: { where: Where }) => {
        const f = store.followups.find((row) => row.id === where.id);
        if (!f) return null;
        return {
          ...f,
          prospect: store.prospects.find((p) => p.id === f.prospectId),
          link: linkOf(f.linkId),
          campaignProspect: f.campaignProspectId ? enrollmentOf(f.campaignProspectId) : null,
        };
      },
      update: async ({ where, data }: { where: Where; data: Row }) => {
        const f = store.followups.find((row) => row.id === where.id)!;
        apply(f, data);
        return f;
      },
    },
    campaignMessage: {
      ...table(() => store.messages),
      create: async ({ data }: { data: Row }) => {
        if (store.messages.some((m) => m.dedupeKey === data.dedupeKey)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: `m${++ids}`, attempts: 0, messageId: null, sentAt: null, error: null, ...data };
        store.messages.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: Where }) => store.messages.find((m) => matches(m, where)) ?? null,
      findFirst: async ({ where }: { where: Where }) =>
        store.messages
          .filter((m) => matches(m, where))
          .sort((a, b) => ((b.sentAt as Date)?.getTime() ?? 0) - ((a.sentAt as Date)?.getTime() ?? 0))[0] ?? null,
    },
    mailbox: { update: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(client),
  };
  return client;
});

const mocks = vi.hoisted(() => ({
  notifySeller: vi.fn(async () => true),
  readingOfLink: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/closing/shared/reading-time", () => ({ readingOfLink: mocks.readingOfLink }));
vi.mock("@/lib/closing/notify/notify", () => ({ notifySeller: mocks.notifySeller }));
vi.mock("@/lib/closing/settings", () => ({
  getWorkspaceSettings: async () => ({
    businessHourStart: 9,
    businessHourEnd: 18,
    businessDays: [1, 2, 3, 4, 5],
    minDelayAfterReadingHours: 3,
    maxFollowupsPer30Days: 3,
    minDaysBetweenFollowups: 3,
    hotPricingThresholdSec: 30,
  }),
}));
vi.mock("@/lib/closing/scheduling/send-time", async () => ({
  habitualSendHour: async () => null,
  nextSendSlot: (await vi.importActual<typeof import("@/lib/closing/scheduling/send-slot")>("@/lib/closing/scheduling/send-slot"))
    .nextSendSlot,
}));
// The queue's writer is the AI: here it writes a draft that carries the link, as the real one does
vi.mock("@/lib/closing/followups/queue", () => ({
  OPEN_FOLLOWUP_STATUSES: ["PENDING", "DRAFT", "GENERATED", "SCHEDULED"],
  isUniqueViolation: (error: unknown) => (error as { code?: string })?.code === "P2002",
  queueFollowup: async (input: Row) => {
    if (store.followups.some((f) => f.dedupeKey === input.dedupeKey)) return null;
    store.followups.push({ id: "f1", status: "PENDING", approvedAt: null, createdAt: new Date(), insightId: null, ...input });
    return "f1";
  },
  generateFollowupMessage: async (id: string) => {
    const f = store.followups.find((row) => row.id === id)!;
    Object.assign(f, { status: "DRAFT", subject: null, body: "Bonjour Paul, les options sont là : https://app.test/v/acme-abc123xyz" });
  },
}));
vi.mock("@/lib/billing/mailboxes", () => ({ canUseMailboxes: async () => true }));
vi.mock("./flag", () => ({ outreachOrgIds: () => ["org"] }));
vi.mock("./suppression", () => ({ isSuppressed: async () => false }));
vi.mock("./ownership", async () => ({
  ...(await vi.importActual<typeof import("./ownership")>("./ownership")),
  releaseCampaignLink: vi.fn(),
}));
vi.mock("@/lib/mailboxes/caps/counter", () => ({ reserveSend: async () => true }));
vi.mock("@/lib/mailboxes/notify-owner", () => ({ notifyMailboxOwner: vi.fn() }));
vi.mock("@/lib/mailboxes", async () => ({
  ...(await vi.importActual<typeof import("@/lib/mailboxes")>("@/lib/mailboxes")),
  connectorFor: () => ({
    capabilities: { listUnsubscribe: true },
    send: async (message: Row) => {
      store.sent.push(message);
      return { messageId: message.messageId, providerId: "p-out", threadId: "t1" };
    },
  }),
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ MAILBOX_DAILY_CAP_MAX: 100 }) }));
vi.mock("@/lib/app-origin", () => ({ getPublicAppUrl: () => "https://app.test" }));
vi.mock("@/lib/email", () => ({ isEmailConfigured: () => false }));
vi.mock("@/lib/closing/active-workspace", () => ({ ACTIVE_WORKSPACE: {} }));
vi.mock("@/lib/closing/channels/whatsapp", () => ({ isWhatsAppConfigured: () => false, sendWhatsApp: vi.fn() }));
vi.mock("@/lib/closing/replies/inbound", () => ({ replyRelayAddress: () => "r@x" }));
vi.mock("@/lib/closing/prospect-email", () => ({ sendProspectEmail: vi.fn() }));

process.env.ENCRYPTION_KEY = "k".repeat(40);

const { evaluateEnrollmentReading } = await import("./reading");
const { sendFollowup } = await import("@/lib/closing/followups/dispatch");

const DAY = 86_400_000;
const MIN = 60_000;
const readAt = new Date("2026-11-18T10:00:00Z"); // Wednesday, 11:00 in Paris
const step1SentAt = new Date(readAt.getTime() - 2 * DAY);

function seed(step2Status: "SCHEDULED" | "CANCELLED") {
  for (const rows of Object.values(store)) rows.length = 0;
  store.mailboxes.push({
    id: "mb1",
    organizationId: "org",
    status: "ACTIVE",
    email: "me@seller.test",
    timezone: "Europe/Paris",
    rampStartedAt: new Date("2026-01-01T00:00:00Z"),
    dailyCap: 50,
  });
  store.campaigns.push({ id: "c1", status: "ACTIVE", mailboxId: "mb1", organizationId: "org", organization: { suspendedAt: null } });
  store.steps.push(
    { id: "s1", campaignId: "c1", order: 1, delayDays: 0, subject: "Votre devis", newThread: false, body: "Voici {{link}}", carriesLink: true },
    { id: "s2", campaignId: "c1", order: 2, delayDays: 3, subject: null, newThread: false, body: "Des nouvelles ?", carriesLink: false },
  );
  store.enrollments.push({
    id: "e1",
    campaignId: "c1",
    organizationId: "org",
    email: "paul@acme.com",
    firstName: "Paul",
    lastName: null,
    company: "Acme",
    title: null,
    vars: null,
    timezone: "Europe/Paris",
    locale: "fr",
    status: "ACTIVE",
    currentStep: 1,
    threadSubject: "Votre devis",
    firstMessageId: "<s1@seller.test>",
    providerThreadId: "t1",
    linkId: "l1",
    prospectId: "p1",
    repliedAt: null,
    lastSignal: null,
    reactivatedAt: null,
    pausedReason: null,
    pausedAt: null,
    readEvaluatedAt: null,
    nextSendAt: null,
  });
  store.links.push({
    id: "l1",
    organizationId: "org",
    documentId: "d1",
    slug: "abc123xyz",
    campaignProspectId: "e1",
    campaignOwned: true,
    followupsEnabled: false,
    archivedAt: null,
    dealStatus: "OPEN",
    snoozedUntil: null,
    meetingBookedAt: null,
    repliedAt: null,
    quoteRequestedAt: null,
    expiresAt: null,
    lastActivityAt: new Date(readAt.getTime() - 10 * MIN),
    createdBy: { email: "seller@x", locale: "fr" },
    document: { name: "Devis", displayTitle: null, docType: null, numPages: 6 },
    engagementScore: null,
  });
  store.prospects.push({ id: "p1", linkId: "l1", origin: "CAMPAIGN", timezone: null, company: "Acme", unsubscribedAt: null, bouncedAt: null });
  store.views.push({
    linkId: "l1",
    isBot: false,
    startedAt: new Date(readAt.getTime() - 20 * MIN),
    lastSeenAt: new Date(readAt.getTime() - 10 * MIN),
    totalDurationMs: 120_000,
    maxPageReached: 4,
  });
  store.messages.push(
    { id: "m-s1", enrollmentId: "e1", campaignId: "c1", mailboxId: "mb1", kind: "STEP", stepId: "s1", status: "SENT", sentAt: step1SentAt, messageId: "<s1@seller.test>", dedupeKey: "cold:e1:s1", attempts: 1 },
    // Planned by the sender right after step 1, due while the enrollment is paused
    { id: "m-s2", enrollmentId: "e1", campaignId: "c1", mailboxId: "mb1", kind: "STEP", stepId: "s2", status: step2Status, scheduledFor: new Date(step1SentAt.getTime() + 3 * DAY), sentAt: null, messageId: null, dedupeKey: "cold:e1:s2", attempts: step2Status === "CANCELLED" ? 1 : 0, error: null },
  );
  mocks.readingOfLink.mockResolvedValue({ readingMs: 120_000, pricingMs: 60_000, tags: ["PRICING"] });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("a pricing read, from the alert to the next step", () => {
  for (const step2Status of ["SCHEDULED", "CANCELLED"] as const) {
    it(`pauses, alerts, drafts, sends on approval, resumes and re-plans the step (step 2 ${step2Status})`, async () => {
      seed(step2Status);
      vi.setSystemTime(readAt);
      expect(await evaluateEnrollmentReading("l1", readAt)).toBe("pause_alert");

      const enrollment = store.enrollments[0];
      expect(enrollment).toMatchObject({ status: "PAUSED", pausedReason: "call_moment", lastSignal: "pricing" });
      expect(mocks.notifySeller).toHaveBeenCalledWith(expect.objectContaining({ type: "CALL_MOMENT", dedupeKey: "cold_call:l1:call_moment" }));
      expect(store.followups).toHaveLength(1);
      expect(store.followups[0]).toMatchObject({ trigger: "COLD_READ_PRICING", status: "DRAFT", campaignProspectId: "e1" });

      // The step's due date passes while paused; two days later the seller approves the draft
      const approvedAt = new Date(readAt.getTime() + 2 * DAY);
      vi.setSystemTime(approvedAt);
      expect(await sendFollowup("f1", { approvedById: "u1" })).toBe("sent");

      expect(store.sent).toHaveLength(1);
      expect(store.sent[0]).toMatchObject({ subject: "Re: Votre devis", inReplyTo: "<s1@seller.test>", to: { address: "paul@acme.com" } });
      expect(store.followups[0]).toMatchObject({ status: "SENT", sentVia: "MAILBOX", approvedById: "u1" });
      const mirror = store.messages.find((m) => m.kind === "FOLLOWUP")!;
      expect(mirror).toMatchObject({ status: "SENT", dedupeKey: "cold:e1:fu:f1", followupId: "f1", sentAt: approvedAt });

      expect(enrollment).toMatchObject({ status: "ACTIVE", pausedReason: null, currentStep: 1 });
      const step2 = store.messages.find((m) => m.dedupeKey === "cold:e1:s2")!;
      expect(step2).toMatchObject({ status: "SCHEDULED", attempts: 0, mailboxId: "mb1" });
      // Its delay runs from the follow-up's send, not from step 1
      expect((step2.scheduledFor as Date).getTime()).toBeGreaterThanOrEqual(approvedAt.getTime() + 3 * DAY);
      expect(enrollment.nextSendAt).toEqual(step2.scheduledFor);
    });
  }
});
