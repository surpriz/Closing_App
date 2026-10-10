import { describe, expect, it } from "vitest";

import { autopilotEligible, decideFollowup, type FollowupPolicyInput } from "./policy";

// Wednesday 7 Oct 2026, 10:00 in Paris
const now = new Date("2026-10-07T08:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const base = (overrides: Partial<FollowupPolicyInput> = {}): FollowupPolicyInput => ({
  now,
  timing: "now",
  channel: "EMAIL",
  deal: {
    dealStatus: "OPEN",
    followupsEnabled: true,
    archived: false,
    snoozedUntil: null,
    decisionDeadline: null,
    channels: ["EMAIL"],
    lastReadingAt: new Date(now.getTime() - 10 * HOUR),
  },
  prospect: { unsubscribed: false, canWhatsApp: false, timezone: "Europe/Paris" },
  history: { sentAt: [], lastSellerContactAt: null, approvedPending: false },
  settings: {
    maxFollowupsPer30Days: 3,
    minDaysBetweenFollowups: 3,
    minDelayAfterReadingHours: 3,
    businessHours: { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] },
  },
  ...overrides,
});

const deal = (patch: Partial<FollowupPolicyInput["deal"]>) => ({ ...base().deal, ...patch });
const history = (patch: Partial<FollowupPolicyInput["history"]>) => ({ ...base().history, ...patch });

describe("decideFollowup", () => {
  it("sends now when nothing stands in the way", () => {
    expect(decideFollowup(base())).toEqual({ allowed: true, scheduledFor: now, channel: "EMAIL" });
  });

  it.each([
    ["closed deal", { deal: deal({ dealStatus: "WON" }) }, "Le deal n'est plus en cours."],
    ["follow-ups off", { deal: deal({ followupsEnabled: false }) }, "Les relances sont coupées sur ce lien."],
    ["snoozed", { deal: deal({ snoozedUntil: new Date(now.getTime() + DAY) }) }, "Le deal est en pause."],
    ["unsubscribed", { prospect: { unsubscribed: true, canWhatsApp: false, timezone: "Europe/Paris" } }, "Le contact s'est désinscrit."],
    ["no contact", { prospect: null }, "Aucun contact à qui écrire."],
    ["approved one waiting", { history: history({ approvedPending: true }) }, "Une relance validée attend déjà son envoi."],
    ["seller talked yesterday", { history: history({ lastSellerContactAt: new Date(now.getTime() - DAY) }) }, "Vous avez échangé avec lui il y a moins de 48 h."],
    ["link expired", { deal: deal({ expiresAt: new Date(now.getTime() - HOUR) }) }, "Le lien a expiré : prolongez-le avant de relancer."],
    ["deadline reminder planned", { history: history({ expiryReminderOpen: true }) }, "Un rappel d'échéance est déjà prévu."],
  ] as const)("blocks: %s", (_label, overrides, reason) => {
    const decision = decideFollowup(base(overrides as Partial<FollowupPolicyInput>));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reasons).toContain(reason);
  });

  it("never schedules a message after the link expires", () => {
    // Last one two days ago: the next may only leave tomorrow, the link locks tonight
    const decision = decideFollowup(
      base({
        deal: deal({ expiresAt: new Date(now.getTime() + 10 * HOUR) }),
        history: history({ sentAt: [new Date(now.getTime() - 2 * DAY)] }),
      }),
    );
    expect(decision).toEqual({ allowed: false, reasons: ["L'envoi tomberait après l'expiration du lien."] });
  });

  it("stops at the monthly maximum", () => {
    const sentAt = [5, 10, 20].map((d) => new Date(now.getTime() - d * DAY));
    const decision = decideFollowup(base({ history: history({ sentAt }) }));
    expect(decision).toEqual({ allowed: false, reasons: ["Déjà 3 relances en 30 jours, le maximum réglé."] });
  });

  it("waits a few hours after a read, so the message doesn't feel triggered by it", () => {
    const decision = decideFollowup(base({ deal: deal({ lastReadingAt: new Date(now.getTime() - HOUR) }) }));
    expect(decision).toMatchObject({ allowed: true, scheduledFor: new Date(now.getTime() + 2 * HOUR) });
  });

  it("keeps the minimum gap after the last follow-up", () => {
    const decision = decideFollowup(base({ history: history({ sentAt: [new Date(now.getTime() - DAY)] }) }));
    // last sent Tuesday 10:00 + 3 days = Friday 10:00 Paris
    expect(decision).toMatchObject({ allowed: true, scheduledFor: new Date("2026-10-09T08:00:00Z") });
  });

  it("maps timings to business slots in the prospect's time zone", () => {
    const at = (timing: FollowupPolicyInput["timing"]) =>
      (decideFollowup(base({ timing })) as { scheduledFor: Date }).scheduledFor.toISOString();
    expect(at("next_business_morning")).toBe("2026-10-08T07:00:00.000Z"); // Thu 9:00 Paris
    expect(at("in_2_business_days")).toBe("2026-10-09T07:00:00.000Z"); // Fri 9:00
    expect(at("in_1_week")).toBe("2026-10-14T08:00:00.000Z"); // next Wed 10:00
  });

  it("lands deadline follow-ups three days before the decision date", () => {
    const decision = decideFollowup(
      base({ timing: "before_deadline", deal: deal({ decisionDeadline: new Date("2026-10-19T10:00:00Z") }) }),
    );
    expect(decision).toMatchObject({ scheduledFor: new Date("2026-10-16T10:00:00Z") });
  });

  it("uses WhatsApp only with consent, falls back to email", () => {
    const whatsapp = base({ channel: "WHATSAPP", deal: deal({ channels: ["EMAIL", "WHATSAPP"] }) });
    expect(decideFollowup(whatsapp)).toMatchObject({ channel: "EMAIL" });
    expect(
      decideFollowup({ ...whatsapp, prospect: { unsubscribed: false, canWhatsApp: true, timezone: "Europe/Paris" } }),
    ).toMatchObject({ channel: "WHATSAPP" });
  });
});

describe("autopilotEligible", () => {
  const ok = {
    now,
    autonomy: "AUTOPILOT" as const,
    minConfidence: 80,
    confidence: 85,
    goal: "propose_call" as const,
    lastProspectTextAt: null,
    guardPassedFirstTry: true,
    offerDescribed: true,
  };

  it("lets a confident, safe, clean message go", () => {
    expect(autopilotEligible(ok)).toBe(true);
  });

  it.each([
    ["copilot mode", { autonomy: "COPILOT" as const }],
    ["low confidence", { confidence: 70 }],
    ["objection handling", { goal: "address_objection" as const }],
    ["prospect wrote recently", { lastProspectTextAt: new Date(now.getTime() - 3 * DAY) }],
    ["guard needed a rewrite", { guardPassedFirstTry: false }],
    ["offer not described", { offerDescribed: false }],
  ])("keeps a draft when: %s", (_label, patch) => {
    expect(autopilotEligible({ ...ok, ...patch })).toBe(false);
  });
});
