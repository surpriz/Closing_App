import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/i18n/messages";

import { buildFeed as build, feedContext, type FeedSource } from "./feed";

const t = createTranslator({ locale: "fr", messages: MESSAGES.fr });
const buildFeed = (source: FeedSource, limit: number) => build(source, limit, t);

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
  it("names the reader, says what happened and keeps the deal and document as context", () => {
    expect(buildFeed({ ...empty, views: [view] }, 10)[0]).toMatchObject({
      kind: "read",
      who: "Léa Martin",
      what: "a lu pendant 4 min 5 s, dont 1 min 30 s sur les tarifs",
      context: "Acme · Devis 2026",
    });
  });

  it("falls back to the deal when the reader is unknown, without repeating it", () => {
    expect(buildFeed({ ...empty, views: [{ ...view, reader: null }] }, 10)[0]).toMatchObject({
      who: "Acme",
      context: "Devis 2026",
    });
  });

  it("drops the document from the context when the deal already carries its name", () => {
    expect(buildFeed({ ...empty, views: [{ ...view, reader: null, linkLabel: "Devis 2026" }] }, 10)[0]).toMatchObject({
      who: "Devis 2026",
      context: null,
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
    expect(glance.what).toBe("a ouvert le document");
    const en = createTranslator({ locale: "en", messages: MESSAGES.en });
    expect(build({ ...empty, views: [view] }, 1, en)[0].what).toBe("read for 4 min 5 s, 1 min 30 s of it on pricing");
    expect(short.what).toBe("a lu pendant 1 min");
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
            linkLabel: "Acme",
            type: "REQUEST_CHANGE",
            documentName: "Devis 2026",
            message: "Remise ?",
          },
        ],
        alerts: [
          {
            id: "y",
            createdAt: at(2),
            linkId: "l1",
            linkLabel: "Acme",
            documentName: "Devis 2026",
            type: "MULTI_VIEWER",
            payload: { liveViewers: 3 },
          },
        ],
        followups: [
          { id: "z", sentAt: at(1), linkId: "l2", who: "Norda", linkLabel: "Norda", channel: "EMAIL", trigger: "ANTI_GHOSTING" },
        ],
      },
      3,
    );
    expect(items.map((item) => [item.kind, item.who, item.what, item.context])).toEqual([
      ["change", "Acme", "demande un ajustement", "Devis 2026"],
      ["alert", "Acme", "est lu par 3 personnes en même temps", "Devis 2026"],
      ["followup", "Norda", "a reçu une relance email (lien pas encore ouvert)", null],
    ]);
    expect(items[0].quote).toBe("Remise ?");
  });

  it("describes every prospect answer without the document name", () => {
    const action = (type: FeedSource["actions"][number]["type"]) =>
      buildFeed(
        { ...empty, actions: [{ id: "a", createdAt: at(1), linkId: "l1", who: "Acme", linkLabel: "Acme", type, documentName: "Devis", message: null }] },
        1,
      )[0].what;
    expect(action("VALIDATE_SIGN")).toBe("a validé la proposition");
    expect(action("REQUEST_EXTENSION")).toBe("demande une prolongation");
    expect(action("MEETING_BOOKED")).toBe("a pris rendez-vous");
    expect(action("MEETING_CLICK")).toBe("a ouvert votre agenda");
    expect(action("REQUEST_QUOTE")).toBe("demande un devis");
  });
});

describe("reader alerts in the feed", () => {
  const alert = (type: "COMMITTEE_LIVE" | "DECISION_MAKER_DETECTED" | "NEW_READER", payload: object) =>
    buildFeed(
      { ...empty, alerts: [{ id: "a", createdAt: at(1), linkId: "l1", linkLabel: "Acme", documentName: "Devis", type, payload }] },
      1,
    )[0].what;

  it("describes committees, decision makers and forwards", () => {
    expect(alert("COMMITTEE_LIVE", { liveViewers: 4 })).toBe("est lu par 4 personnes en même temps (comité)");
    expect(alert("DECISION_MAKER_DETECTED", {})).toBe("est lu par un décideur");
    expect(alert("NEW_READER", { readerOrigin: "forwarded_internal" })).toBe("a été repartagé en interne");
    expect(alert("NEW_READER", { readerOrigin: "anonymous" })).toBe("a un nouveau lecteur");
  });
});

describe("feedContext", () => {
  it("lists the deal and the document once each, skipping whatever is already said", () => {
    expect(feedContext("Léa Martin", "Acme", "Devis 2026")).toBe("Acme · Devis 2026");
    expect(feedContext("Acme", "Acme", "Devis 2026")).toBe("Devis 2026");
    expect(feedContext("Devis 2026", "Devis 2026", "Devis 2026")).toBeNull();
    expect(feedContext("Norda", "Norda", null)).toBeNull();
  });
});
