import { describe, expect, it } from "vitest";

import {
  compareByUrgency,
  computeNextAction,
  describeNextAction,
  isUrgent,
  type NextActionInput,
} from "./next-action";

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
      describeNextAction({ kind: "call_now" }, now),
      describeNextAction({ kind: "reply" }, now),
      describeNextAction({ kind: "call", pricing: true }, now),
      describeNextAction({ kind: "call", pricing: false }, now),
      describeNextAction({ kind: "nudge", days: 4, opened: true }, now),
      describeNextAction({ kind: "wait", days: 1, opened: true, tier: "WARM" }, now),
    ];
    for (const text of texts) expect(text).not.toMatch(/\b(il|elle|-le|-la)\b|engagée?\b|intéressée?\b/i);
  });

  it("explains an unopened link with its follow-up", () => {
    expect(
      describeNextAction({ kind: "followup_planned", at: new Date(now.getTime() + DAY), opened: false }, now),
    ).toBe("Pas encore ouvert. Relance auto demain.");
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
