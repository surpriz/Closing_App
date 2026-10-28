import { describe, expect, it } from "vitest";

import { DAY_MS } from "@/lib/closing/constants";

import { signalsFrom } from "./signals";

const now = new Date("2026-10-28T10:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
const base = {
  reading: { readingMs: 42_000, pricingMs: 5_000, tags: ["PRICING" as const] },
  views: [],
  deepRead: false,
  forwards: [],
  enrollment: { repliedAt: null, lastSignal: null, reactivatedAt: null },
  sent: [],
  openFollowup: false,
  now,
};

describe("signalsFrom", () => {
  it("is unopened with no views", () => {
    const s = signalsFrom(base);
    expect(s).toMatchObject({ opened: false, sessions: 0, lastReadAt: null, lastSentAt: null, sentLast30: 0, replied: false });
    expect(s.readingMs).toBe(42_000);
    expect(s.pricingMs).toBe(5_000);
    expect(s.readTags).toEqual(["PRICING"]);
  });

  it("ignores bots for opened, sessions and lastReadAt", () => {
    const s = signalsFrom({
      ...base,
      views: [
        { startedAt: ago(3), lastSeenAt: ago(3), isBot: false },
        { startedAt: ago(2), lastSeenAt: ago(1), isBot: false },
        { startedAt: ago(0), lastSeenAt: ago(0), isBot: true },
      ],
    });
    expect(s.opened).toBe(true);
    expect(s.sessions).toBe(2);
    expect(s.lastReadAt).toEqual(ago(1));
  });

  it("only bot views is not opened", () => {
    const s = signalsFrom({ ...base, views: [{ startedAt: ago(1), lastSeenAt: ago(1), isBot: true }] });
    expect(s).toMatchObject({ opened: false, sessions: 0, lastReadAt: null });
  });

  it("dedupes forwards case-insensitively", () => {
    const s = signalsFrom({ ...base, forwards: [{ toEmail: "Bob@Acme.com" }, { toEmail: "bob@acme.com" }, { toEmail: "eve@acme.com" }] });
    expect(s.forwardedTo).toEqual(["bob@acme.com", "eve@acme.com"]);
  });

  it("takes lastSentAt across both kinds and counts the last 30 days", () => {
    const s = signalsFrom({
      ...base,
      sent: [
        { sentAt: ago(40), kind: "STEP" },
        { sentAt: ago(10), kind: "STEP" },
        { sentAt: ago(2), kind: "FOLLOWUP" },
      ],
    });
    expect(s.lastSentAt).toEqual(ago(2));
    expect(s.sentLast30).toBe(2);
  });

  it("carries replied, lastSignal, reactivatedAt, deepRead and openFollowup", () => {
    const s = signalsFrom({
      ...base,
      deepRead: true,
      openFollowup: true,
      enrollment: { repliedAt: ago(1), lastSignal: "deep", reactivatedAt: ago(9) },
    });
    expect(s).toMatchObject({ replied: true, lastSignal: "deep", reactivatedAt: ago(9), deepRead: true, openFollowup: true });
  });
});
