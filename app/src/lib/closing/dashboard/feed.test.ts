import { describe, expect, it } from "vitest";

import { buildFeed, readerLabel, type FeedSource } from "./feed";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 4, 10, minutes));
const empty: FeedSource = { views: [], actions: [], alerts: [], followups: [] };
const view: FeedSource["views"][number] = {
  id: "v1",
  lastSeenAt: at(0),
  linkId: "l1",
  linkLabel: "Acme",
  reader: "Léa Martin",
  documentName: "Devis 2026",
  totalDurationMs: 245_000,
  pricingDurationMs: 90_000,
};

describe("buildFeed", () => {
  it("describes a reading session with its pricing time", () => {
    expect(buildFeed({ ...empty, views: [view] }, 10)[0]).toMatchObject({
      kind: "read",
      who: "Léa Martin (Acme)",
      what: "a lu Devis 2026 pendant 4 min 5 s, dont 1 min 30 s sur les tarifs",
    });
  });

  it("says opened for a glance and leaves short pricing time out", () => {
    const [glance, short] = buildFeed(
      {
        ...empty,
        views: [
          { ...view, id: "a", totalDurationMs: 8_000, lastSeenAt: at(5) },
          { ...view, id: "b", totalDurationMs: 60_000, pricingDurationMs: 10_000 },
        ],
      },
      10,
    );
    expect(glance.what).toBe("a ouvert Devis 2026");
    expect(short.what).toBe("a lu Devis 2026 pendant 1 min");
  });

  it("merges every source newest first and applies the limit", () => {
    const items = buildFeed(
      {
        views: [view],
        actions: [
          {
            id: "x",
            createdAt: at(3),
            linkId: "l1",
            who: "Acme",
            type: "REQUEST_CHANGE",
            documentName: "Devis 2026",
            message: "Remise ?",
          },
        ],
        alerts: [
          { id: "y", createdAt: at(2), linkId: "l1", linkLabel: "Acme", type: "MULTI_VIEWER", payload: { liveViewers: 3 } },
        ],
        followups: [
          { id: "z", sentAt: at(1), linkId: "l2", who: "Norda", channel: "EMAIL", trigger: "ANTI_GHOSTING" },
        ],
      },
      3,
    );
    expect(items.map((item) => [item.kind, item.what])).toEqual([
      ["change", "demande un ajustement sur Devis 2026"],
      ["alert", "est lu par 3 personnes en même temps"],
      ["followup", "a reçu une relance email (lien pas encore ouvert)"],
    ]);
    expect(items[0].quote).toBe("Remise ?");
  });
});

describe("reader alerts in the feed", () => {
  const alert = (type: "COMMITTEE_LIVE" | "DECISION_MAKER_DETECTED" | "NEW_READER", payload: object) =>
    buildFeed({ views: [], actions: [], alerts: [{ id: "a", createdAt: at(1), linkId: "l1", linkLabel: "Acme", type, payload }], followups: [] }, 1)[0]
      .what;

  it("describes committees, decision makers and forwards", () => {
    expect(alert("COMMITTEE_LIVE", { liveViewers: 4 })).toBe("est lu par 4 personnes en même temps (comité)");
    expect(alert("DECISION_MAKER_DETECTED", {})).toBe("est lu par un décideur");
    expect(alert("NEW_READER", { readerOrigin: "forwarded_internal" })).toBe("a été repartagé en interne");
    expect(alert("NEW_READER", { readerOrigin: "anonymous" })).toBe("a un nouveau lecteur");
  });
});

describe("readerLabel", () => {
  it("does not repeat the company", () => {
    expect(readerLabel("Acme", "Acme")).toBe("Acme");
    expect(readerLabel(null, "Acme")).toBe("Acme");
  });
});
