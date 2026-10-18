import { describe, expect, it } from "vitest";

import { extensionRequestKey } from "./expiry";
import {
  canDraftInterestFollowup,
  deadOpenKey,
  deadState,
  interestFollowupTarget,
  revivalRequestKey,
  revivalSignal,
  revivalWho,
} from "./revival";

const now = new Date("2026-10-18T10:00:00Z");
const before = new Date("2026-10-10T10:00:00Z");
const later = new Date("2026-10-25T10:00:00Z");

const link = (over: Partial<Parameters<typeof deadState>[0]> = {}) => ({
  archivedAt: null,
  expiresAt: null,
  dealStatus: "OPEN" as const,
  document: { archivedAt: null },
  ...over,
});

describe("deadState", () => {
  it("is null for a live link", () => {
    expect(deadState(link(), now)).toBeNull();
    expect(deadState(link({ expiresAt: later }), now)).toBeNull();
  });

  it("reads an archived link or document", () => {
    expect(deadState(link({ archivedAt: before }), now)).toEqual({ kind: "archived", since: before });
    expect(deadState(link({ document: { archivedAt: before } }), now)).toEqual({ kind: "archived", since: before });
  });

  it("prefers the link's own archive date, and archived over expired", () => {
    const docDate = new Date("2026-10-01T00:00:00Z");
    expect(deadState(link({ archivedAt: before, document: { archivedAt: docDate }, expiresAt: docDate }), now)).toEqual({
      kind: "archived",
      since: before,
    });
  });

  it("reads an expired link, never a signed one", () => {
    expect(deadState(link({ expiresAt: before }), now)).toEqual({ kind: "expired", since: before });
    expect(deadState(link({ expiresAt: before, dealStatus: "VALIDATED" }), now)).toBeNull();
    expect(deadState(link({ expiresAt: before, dealStatus: "WON" }), now)).toBeNull();
  });
});

describe("keys", () => {
  it("keeps the legacy extension key for expired links", () => {
    expect(revivalRequestKey("l1", { kind: "expired", since: before }, "p1")).toBe(extensionRequestKey("l1", before, "p1"));
  });

  it("separates archived requests and passive opens", () => {
    const dead = { kind: "archived" as const, since: before };
    expect(revivalRequestKey("l1", dead, "p1")).toBe(`relink_request:l1:${before.getTime()}:p1`);
    expect(deadOpenKey("l1", dead, "p1")).toBe(`dead_open:l1:archived:${before.getTime()}:p1`);
  });
});

describe("revivalWho", () => {
  it("falls back from prospect to browser to network", () => {
    expect(revivalWho({ prospectId: "p", visitorId: "v", ipHash: "i" })).toBe("p");
    expect(revivalWho({ visitorId: "v", ipHash: "i" })).toBe("v");
    expect(revivalWho({ ipHash: "i" })).toBe("i");
    expect(revivalWho({})).toBe("anonymous");
  });
});

describe("revivalSignal", () => {
  const dead = { kind: "archived" as const, since: before };

  it("ignores alerts from before the link died", () => {
    expect(revivalSignal(dead, { type: "RELINK_REQUESTED", createdAt: new Date("2026-10-01T00:00:00Z") })).toBeNull();
    expect(revivalSignal(null, { type: "RELINK_REQUESTED", createdAt: now })).toBeNull();
  });

  it("tells a request from a passive open", () => {
    expect(revivalSignal(dead, { type: "DEAD_LINK_OPENED", createdAt: now })).toEqual({ at: now, asked: false, state: "archived" });
    expect(revivalSignal(dead, { type: "RELINK_REQUESTED", createdAt: now })?.asked).toBe(true);
  });
});

describe("interestFollowupTarget", () => {
  const base = {
    dealStatus: "OPEN" as const,
    followupsEnabled: true,
    meetingBookedAt: null,
    quoteRequestedAt: null,
    told: [] as string[],
    returned: [] as string[],
    prospects: [
      { id: "a", origin: "SELLER" as const, unsubscribedAt: null },
      { id: "b", origin: "SELLER" as const, unsubscribedAt: null },
      { id: "g", origin: "EMAIL_GATE" as const, unsubscribedAt: null },
    ],
  };

  it("picks the seller's recipient who came back, else the first one", () => {
    expect(interestFollowupTarget({ ...base, returned: ["b"] })).toBe("b");
    expect(interestFollowupTarget(base)).toBe("a");
  });

  it("never writes to someone who typed an email on the dead page", () => {
    expect(interestFollowupTarget({ ...base, returned: ["g"] })).toBe("a");
    expect(interestFollowupTarget({ ...base, prospects: [base.prospects[2]] })).toBeNull();
  });

  it("skips closed or paused deals", () => {
    expect(interestFollowupTarget({ ...base, dealStatus: "LOST" })).toBeNull();
    expect(interestFollowupTarget({ ...base, followupsEnabled: false })).toBeNull();
    expect(interestFollowupTarget({ ...base, meetingBookedAt: now })).toBeNull();
    expect(interestFollowupTarget({ ...base, quoteRequestedAt: now })).toBeNull();
  });

  it("does not write twice to someone the reactivation email told", () => {
    expect(interestFollowupTarget({ ...base, told: ["a"] })).toBeNull();
  });

  it("offers the draft only when someone could get it", () => {
    expect(canDraftInterestFollowup(base)).toBe(true);
    expect(canDraftInterestFollowup({ ...base, dealStatus: "LOST" })).toBe(false);
    expect(canDraftInterestFollowup({ ...base, prospects: [base.prospects[2]] })).toBe(false);
  });

  it("skips unsubscribed contacts", () => {
    const prospects = [{ ...base.prospects[0], unsubscribedAt: now }, base.prospects[1]];
    expect(interestFollowupTarget({ ...base, prospects })).toBe("b");
  });
});
