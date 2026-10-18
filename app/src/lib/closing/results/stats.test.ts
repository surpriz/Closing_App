import { describe, expect, it } from "vitest";

import { dealProfile, groupOutcomes, learningsLine, lostReasons, reactionTimes, sendHourKey, type FollowupRow } from "./stats";

const DAY = 24 * 60 * 60 * 1000;
const sent = new Date("2026-10-06T08:15:00Z");
const row = (patch: Partial<FollowupRow>): FollowupRow => ({
  trigger: "AI_DECISION",
  goal: "propose_call",
  sentAt: sent,
  timezone: "Europe/Paris",
  clickedAt: null,
  repliedAt: null,
  bouncedAt: null,
  meetingBookedAt: null,
  ...patch,
});

describe("follow-up outcomes", () => {
  it("counts clicks, replies and meetings booked soon after", () => {
    const [group] = groupOutcomes(
      [
        row({ clickedAt: sent, repliedAt: sent }),
        row({ meetingBookedAt: new Date(sent.getTime() + 3 * DAY) }),
        row({ meetingBookedAt: new Date(sent.getTime() + 30 * DAY) }),
        row({ bouncedAt: sent }),
      ],
      (r) => r.trigger,
    );
    expect(group).toEqual({ key: "AI_DECISION", sent: 4, clicked: 1, replied: 1, meetings: 1, bounced: 1 });
  });

  it("groups by the hour the prospect got it", () => {
    expect(sendHourKey(row({}))).toBe("10");
  });

  it("learns only from goals with enough messages", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row({ goal: "propose_call", repliedAt: i < 3 ? sent : null })),
      ...Array.from({ length: 6 }, (_, i) => row({ goal: "gentle_reminder", repliedAt: i < 1 ? sent : null })),
      row({ goal: "share_case_study", repliedAt: sent }),
    ];
    expect(learningsLine(groupOutcomes(rows, (r) => r.goal))).toBe("propose_call: 50% (6), gentle_reminder: 17% (6)");
    expect(learningsLine(groupOutcomes(rows.slice(0, 6), (r) => r.goal))).toBeNull();
  });
});

describe("closed deals", () => {
  it("compares medians and counts lost reasons", () => {
    const closed = [
      { status: "WON" as const, readingMs: 600_000, visits: 4, readers: 3, pricingRead: true, sentAt: sent, closedAt: new Date(sent.getTime() + 10 * DAY), reason: null },
      { status: "WON" as const, readingMs: 200_000, visits: 2, readers: 1, pricingRead: false, sentAt: sent, closedAt: new Date(sent.getTime() + 20 * DAY), reason: null },
    ];
    expect(dealProfile(closed)).toMatchObject({ count: 2, readingMs: 400_000, visits: 3, pricingShare: 0.5, daysToClose: 15 });
    expect(
      lostReasons([
        { ...closed[0], status: "LOST", reason: "PRICE" },
        { ...closed[0], status: "LOST", reason: "PRICE" },
        { ...closed[0], status: "LOST", reason: null },
      ]),
    ).toEqual([
      { reason: "PRICE", count: 2 },
      { reason: "UNKNOWN", count: 1 },
    ]);
  });
});

describe("reaction times", () => {
  it("takes the median delay and counts alerts left unseen", () => {
    const now = new Date(sent.getTime() + 3 * DAY);
    const [seller] = reactionTimes(
      [
        { userId: "u", createdAt: sent, seenAt: new Date(sent.getTime() + 10 * 60 * 1000) },
        { userId: "u", createdAt: sent, seenAt: new Date(sent.getTime() + 3 * 60 * 60 * 1000) },
        { userId: "u", createdAt: sent, seenAt: null },
      ],
      now,
    );
    expect(seller).toMatchObject({ alerts: 3, missed: 1 });
    expect(seller.medianMs).toBe((10 * 60 * 1000 + 3 * 60 * 60 * 1000) / 2);
  });
});
