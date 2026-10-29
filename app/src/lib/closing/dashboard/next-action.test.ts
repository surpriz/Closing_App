import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/i18n/messages";

import {
  compareByUrgency,
  computeNextAction,
  describeNextAction,
  isUrgent,
  type NextActionInput,
  withAiAdvice,
} from "./next-action";

const i18n = { t: createTranslator({ locale: "fr", messages: MESSAGES.fr }), locale: "fr" as const };
const en = { t: createTranslator({ locale: "en", messages: MESSAGES.en }), locale: "en" as const };

const now = new Date("2026-10-04T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(now.getTime() - days * DAY);

const base: NextActionInput = {
  now,
  dealStatus: "OPEN",
  readingNow: false,
  opened: true,
  tier: "COLD",
  pricingFocus: false,
  lastActivityAt: ago(1),
  sentAt: ago(5),
  followupsEnabled: true,
  nextFollowup: null,
  draftToReview: false,
  lastSellerContactAt: null,
  snoozedUntil: null,
};

describe("computeNextAction", () => {
  it("asks to confirm the sale once the prospect signed, even while they read", () => {
    const action = computeNextAction({ ...base, dealStatus: "VALIDATED", readingNow: true });
    expect(action).toEqual({ kind: "close_won" });
    expect(isUrgent(action)).toBe(true);
    expect(withAiAdvice(action, { type: "wait", timing: "now", priority: 1 })).toEqual(action);
  });

  it("asks to send the quote a video pitch prospect asked for, until the seller logs a contact", () => {
    const asked = { ...base, quoteRequestedAt: ago(1), tier: "HOT" as const };
    const action = computeNextAction(asked);
    expect(action).toEqual({ kind: "reply", quote: true });
    expect(describeNextAction(action, now, i18n)).toBe("Devis demandé : envoyez-le.");
    expect(isUrgent(action)).toBe(true);
    expect(computeNextAction({ ...asked, lastSellerContactAt: ago(0.5) }).kind).not.toBe("reply");
  });

  it("hands an email reply to the seller for a few days, until they log a contact", () => {
    const replied = { ...base, repliedAt: ago(1) };
    const action = computeNextAction(replied);
    expect(action).toEqual({ kind: "reply", email: true });
    expect(describeNextAction(action, now, i18n)).toBe("Il vous a répondu par email : à vous de jouer.");
    expect(computeNextAction({ ...replied, lastSellerContactAt: ago(0.5) }).kind).not.toBe("reply");
    expect(computeNextAction({ ...base, repliedAt: ago(4) }).kind).not.toBe("reply");
  });

  it("tells a click stopped at the email gate from a link never opened", () => {
    const action = computeNextAction({ ...base, opened: false, sentAt: ago(1), gateSeenAt: ago(1) });
    expect(action).toEqual({ kind: "wait", days: 1, opened: false, tier: null, clicked: true });
    expect(describeNextAction(action, now, en)).toBe("Clicked the link, but stopped at the email screen.");
  });

  it("puts a live reader before anything else", () => {
    expect(computeNextAction({ ...base, readingNow: true, dealStatus: "CHANGE_REQUESTED" })).toEqual({
      kind: "call_now",
    });
  });

  it("asks to answer a change request", () => {
    expect(computeNextAction({ ...base, dealStatus: "CHANGE_REQUESTED", tier: "HOT" })).toEqual({ kind: "reply" });
  });

  it("asks to call a hot prospect", () => {
    expect(computeNextAction({ ...base, tier: "HOT" })).toEqual({ kind: "call", pricing: false });
  });

  it("asks to call after a recent pricing read, not an old one", () => {
    expect(computeNextAction({ ...base, pricingFocus: true, lastActivityAt: ago(3) })).toEqual({
      kind: "call",
      pricing: true,
    });
    expect(computeNextAction({ ...base, pricingFocus: true, lastActivityAt: ago(4) }).kind).toBe("nudge");
  });

  describe("unopened link", () => {
    const unopened = { ...base, opened: false, tier: null, lastActivityAt: null };

    it("shows the planned follow-up", () => {
      const at = new Date(now.getTime() + DAY);
      expect(computeNextAction({ ...unopened, nextFollowup: { scheduledFor: at } })).toEqual({
        kind: "followup_planned",
        at,
        opened: false,
      });
    });

    it("asks for a manual nudge when follow-ups are off", () => {
      expect(computeNextAction({ ...unopened, followupsEnabled: false })).toEqual({
        kind: "nudge",
        days: 5,
        opened: false,
      });
    });

    it("waits right after sending", () => {
      expect(computeNextAction({ ...unopened, followupsEnabled: false, sentAt: ago(1) })).toEqual({
        kind: "wait",
        days: 1,
        opened: false,
        tier: null,
      });
    });
  });

  it("asks for a nudge once a reader went quiet", () => {
    expect(computeNextAction({ ...base, lastActivityAt: ago(3) })).toEqual({ kind: "nudge", days: 3, opened: true });
    expect(computeNextAction({ ...base, tier: "WARM", lastActivityAt: ago(2) })).toEqual({
      kind: "wait",
      days: 2,
      opened: true,
      tier: "WARM",
    });
  });
});

describe("describeNextAction", () => {
  it("never genders the prospect", () => {
    const texts = [
      describeNextAction({ kind: "call_now" }, now, i18n),
      describeNextAction({ kind: "reply" }, now, i18n),
      describeNextAction({ kind: "call", pricing: true }, now, i18n),
      describeNextAction({ kind: "call", pricing: false }, now, i18n),
      describeNextAction({ kind: "nudge", days: 4, opened: true }, now, i18n),
      describeNextAction({ kind: "wait", days: 1, opened: true, tier: "WARM" }, now, i18n),
    ];
    for (const text of texts) expect(text).not.toMatch(/\b(il|elle|-le|-la)\b|engagée?\b|intéressée?\b/i);
  });

  it("explains an unopened link with its follow-up", () => {
    expect(
      describeNextAction({ kind: "followup_planned", at: new Date(now.getTime() + DAY), opened: false }, now, i18n),
    ).toBe("Pas encore ouvert. Relance auto demain.");
  });
});

describe("campaign-owned deals", () => {
  const campaign = { name: "Q4 DAF", step: 2, steps: 4 };

  it("leaves the plan to the campaign, whatever the temperature", () => {
    expect(computeNextAction({ ...base, campaign, tier: "HOT" })).toEqual({ kind: "campaign", ...campaign });
    expect(computeNextAction({ ...base, campaign, opened: false, lastActivityAt: null })).toEqual({
      kind: "campaign",
      ...campaign,
    });
  });

  it("still lets facts of the moment through", () => {
    expect(computeNextAction({ ...base, campaign, readingNow: true })).toEqual({ kind: "call_now" });
    expect(computeNextAction({ ...base, campaign, draftToReview: true })).toEqual({ kind: "review_draft" });
  });

  it("keeps the analysis from overriding it, and is not urgent", () => {
    const action = computeNextAction({ ...base, campaign });
    expect(withAiAdvice(action, { type: "send_followup", timing: "now", priority: 5 })).toEqual(action);
    expect(isUrgent(action)).toBe(false);
  });

  it("is described with its step", () => {
    const action = { kind: "campaign", ...campaign } as const;
    expect(describeNextAction(action, now, en)).toBe("Campaign Q4 DAF · step 2/4");
    expect(describeNextAction(action, now, i18n)).toBe("Campagne Q4 DAF · étape 2/4");
  });
});

describe("isUrgent", () => {
  it("separates things to do from waiting", () => {
    expect(isUrgent({ kind: "call_now" })).toBe(true);
    expect(isUrgent({ kind: "nudge", days: 3, opened: true })).toBe(true);
    expect(isUrgent({ kind: "followup_planned", at: now, opened: false })).toBe(false);
    expect(isUrgent({ kind: "wait", days: 0, opened: true, tier: "COLD" })).toBe(false);
  });
});

describe("compareByUrgency", () => {
  it("sorts by urgency, then score, then recency", () => {
    const row = (kind: "call_now" | "wait", score: number, days: number) => ({
      action: kind === "call_now" ? ({ kind } as const) : ({ kind, days: 0, opened: true, tier: null } as const),
      score,
      lastActivityAt: ago(days),
    });
    const rows = [row("wait", 90, 1), row("wait", 40, 0), row("call_now", 10, 0), row("wait", 40, 2)];
    expect(rows.sort(compareByUrgency).map((r) => [r.action.kind, r.score, r.lastActivityAt])).toEqual([
      ["call_now", 10, ago(0)],
      ["wait", 90, ago(1)],
      ["wait", 40, ago(0)],
      ["wait", 40, ago(2)],
    ]);
  });
});

describe("seller-side context", () => {
  it("asks to review a waiting draft right after a change request", () => {
    expect(computeNextAction({ ...base, tier: "HOT", draftToReview: true })).toEqual({ kind: "review_draft" });
    expect(computeNextAction({ ...base, dealStatus: "CHANGE_REQUESTED", draftToReview: true })).toEqual({
      kind: "reply",
    });
    expect(isUrgent({ kind: "review_draft" })).toBe(true);
  });

  it("waits after a call or a reply logged less than two days ago", () => {
    const at = new Date(now.getTime() - 1 * DAY);
    expect(computeNextAction({ ...base, tier: "HOT", lastSellerContactAt: at })).toEqual({ kind: "in_touch", at });
    expect(computeNextAction({ ...base, tier: "HOT", lastSellerContactAt: ago(3) }).kind).toBe("call");
  });

  it("stops chasing once the prospect booked a meeting", () => {
    const at = ago(1);
    expect(computeNextAction({ ...base, lastActivityAt: ago(10), meetingBookedAt: at })).toEqual({
      kind: "meeting_booked",
      at,
      meetingAt: null,
    });
    expect(computeNextAction({ ...base, readingNow: true, meetingBookedAt: at }).kind).toBe("call_now");
    expect(isUrgent({ kind: "meeting_booked", at, meetingAt: null })).toBe(false);
  });

  it("lets the booking go after the meeting, or after a week without a date", () => {
    const soon = new Date(now.getTime() + 2 * DAY);
    expect(computeNextAction({ ...base, lastActivityAt: ago(10), meetingBookedAt: ago(20), meetingAt: soon }).kind).toBe(
      "meeting_booked",
    );
    expect(computeNextAction({ ...base, lastActivityAt: ago(10), meetingBookedAt: ago(20), meetingAt: ago(2) }).kind).toBe(
      "nudge",
    );
    expect(computeNextAction({ ...base, lastActivityAt: ago(10), meetingBookedAt: ago(8) }).kind).toBe("nudge");
  });

  it("says when the meeting is", () => {
    const meetingAt = new Date("2026-12-03T09:00:00Z");
    expect(describeNextAction({ kind: "meeting_booked", at: ago(1), meetingAt }, now, i18n)).toBe(
      "Rendez-vous le 3 décembre : préparez l'échange.",
    );
  });

  it("stays quiet while the deal is snoozed, then resumes", () => {
    const until = new Date(now.getTime() + 2 * DAY);
    expect(computeNextAction({ ...base, lastActivityAt: ago(10), snoozedUntil: until })).toEqual({
      kind: "snoozed",
      until,
    });
    expect(computeNextAction({ ...base, lastActivityAt: ago(10), snoozedUntil: ago(1) }).kind).toBe("nudge");
  });

  it("still flags a live reader on a snoozed deal", () => {
    expect(computeNextAction({ ...base, readingNow: true, snoozedUntil: new Date(now.getTime() + DAY) }).kind).toBe(
      "call_now",
    );
  });

  it("puts snoozed deals last", () => {
    const row = (action: Parameters<typeof describeNextAction>[0]) => ({ action, score: 50, lastActivityAt: null });
    expect(
      compareByUrgency(row({ kind: "snoozed", until: now }), row({ kind: "wait", days: 1, opened: true, tier: null })),
    ).toBeGreaterThan(0);
  });
});

describe("withAiAdvice", () => {
  it("lets a current analysis overrule the score-based call", () => {
    const action = withAiAdvice({ kind: "call", pricing: false }, { type: "wait", timing: "now", priority: 2 });
    expect(action).toEqual({ kind: "ai_advice", adviceType: "wait", timing: "now", urgent: false });
    expect(describeNextAction(action, now, i18n)).toBe("Rien à faire pour l'instant, Clozer surveille.");
    expect(isUrgent(action)).toBe(false);
  });

  it("phrases an urgent recommendation", () => {
    const action = withAiAdvice(
      { kind: "wait", days: 1, opened: true, tier: "WARM" },
      { type: "call", timing: "next_business_morning", priority: 5 },
    );
    expect(action).toEqual({ kind: "ai_advice", adviceType: "call", timing: "next_business_morning", urgent: true });
    expect(describeNextAction(action, now, i18n)).toBe("Appeler demain matin.");
    expect(describeNextAction(action, now, en)).toBe("Call tomorrow morning.");
  });

  it("never hides a fact of the moment", () => {
    for (const fact of [{ kind: "call_now" }, { kind: "reply" }, { kind: "review_draft" }] as const) {
      expect(withAiAdvice(fact, { type: "wait", timing: "now", priority: 1 })).toBe(fact);
    }
  });

  it("keeps the rules when there is no current analysis", () => {
    const rule = { kind: "nudge", days: 4, opened: true } as const;
    expect(withAiAdvice(rule, null)).toBe(rule);
  });
});

describe("reactivate", () => {
  const revival = { at: ago(1), asked: true, state: "archived" as const };

  it("leads once the prospect came back to a dead link, above a draft or a request", () => {
    const action = computeNextAction({ ...base, revival, draftToReview: true, dealStatus: "CHANGE_REQUESTED" });
    expect(action).toEqual({ kind: "reactivate", ...revival });
    expect(isUrgent(action)).toBe(true);
    expect(withAiAdvice(action, { type: "wait", timing: "now", priority: 1 })).toEqual(action);
  });

  it("still lets a signature come first", () => {
    expect(computeNextAction({ ...base, revival, dealStatus: "VALIDATED" })).toEqual({ kind: "close_won" });
  });

  it("says whether they asked or only came back", () => {
    expect(describeNextAction({ kind: "reactivate", ...revival }, now, i18n)).toMatch(/^Document redemandé .+ : réactivez le lien\.$/);
    expect(describeNextAction({ kind: "reactivate", ...revival, asked: false }, now, en)).toMatch(/^Back on the link .+: reactivate it\.$/);
  });
});

describe("computeNextAction on a link nobody is named on", () => {
  const base = {
    now: new Date("2026-10-28T10:00:00Z"),
    dealStatus: "OPEN" as const,
    opened: true,
    tier: "HOT" as const,
    pricingFocus: false,
    lastActivityAt: new Date("2026-10-28T09:00:00Z"),
    sentAt: new Date("2026-10-27T09:00:00Z"),
    followupsEnabled: true,
    nextFollowup: null,
    draftToReview: false,
    lastSellerContactAt: null,
    snoozedUntil: null,
    anonymous: true,
  };

  it("asks to find out who reads instead of calling no one", () => {
    expect(computeNextAction({ ...base, readingNow: true })).toEqual({ kind: "identify", live: true });
    expect(computeNextAction({ ...base, readingNow: false })).toEqual({ kind: "identify", live: false });
  });

  it("still calls when the reader is known", () => {
    expect(computeNextAction({ ...base, anonymous: false, readingNow: true })).toEqual({ kind: "call_now" });
  });
});
