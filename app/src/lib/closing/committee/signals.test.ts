import { describe, expect, it } from "vitest";

import { buildReaderMap, type ReaderProspect, type ReaderView } from "./reader-map";
import { committeeKey, detectCommittee, detectDecisionMaker, detectNewReader, pickReaderAlert } from "./signals";

const now = new Date(Date.UTC(2026, 9, 9, 10, 0));
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

const view = (id: string, visitorId: string, extra: Partial<ReaderView> = {}): ReaderView => ({
  id,
  linkId: "l1",
  visitorId,
  prospectId: null,
  email: null,
  ipHash: null,
  deviceType: "desktop",
  browser: "chrome",
  os: "macos",
  startedAt: ago(30),
  lastSeenAt: ago(0.5),
  leftAt: null,
  totalDurationMs: 60_000,
  ...extra,
});

const prospect = (id: string, email: string, extra: Partial<ReaderProspect> = {}): ReaderProspect => ({
  id,
  email,
  name: null,
  role: null,
  origin: "EMAIL_GATE",
  createdAt: ago(10),
  ...extra,
});

const anne = prospect("p1", "anne@acme.fr", { name: "Anne Martin", origin: "SELLER", createdAt: ago(1000) });
const cfo = prospect("p2", "cfo@acme.fr");
const paul = prospect("p3", "paul@acme.fr", { name: "Paul" });

const mapOf = (views: ReaderView[], prospects: ReaderProspect[] = [anne, cfo, paul]) => buildReaderMap({ views, prospects, now });

describe("detectCommittee", () => {
  it("fires at the threshold, not below", () => {
    const two = mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p3" })]);
    expect(detectCommittee(two, "l1", 3, now)).toBeNull();

    const three = mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p2" }), view("c", "z", { prospectId: "p3" })]);
    const alert = detectCommittee(three, "l1", 3, now);
    expect(alert).toMatchObject({ type: "COMMITTEE_LIVE", liveViewers: 3, decisionMakers: ["cfo@acme.fr"] });
    expect(alert?.reason).toContain("dont un décideur");
  });

  it("counts one person on two browsers once", () => {
    const map = mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { email: "anne@acme.fr" }), view("c", "z", { prospectId: "p3" })]);
    expect(detectCommittee(map, "l1", 3, now)).toBeNull();
  });

  it("keeps one key per link in a 2h window", () => {
    expect(committeeKey("l1", now)).toBe(committeeKey("l1", new Date(now.getTime() + 60_000)));
    expect(committeeKey("l1", now)).not.toBe(committeeKey("l1", new Date(now.getTime() + 2 * 60 * 60_000)));
  });
});

describe("detectNewReader", () => {
  it("stays quiet for the recipient and a lone reader", () => {
    expect(detectNewReader(mapOf([view("a", "x", { prospectId: "p1" })]), "l1", "a")).toBeNull();
    expect(detectNewReader(mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p3" })]), "l1", "a")).toBeNull();
  });

  it("reports an internal forward", () => {
    const alert = detectNewReader(mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p3" })]), "l1", "b");
    expect(alert).toMatchObject({ type: "NEW_READER", dedupeKey: "new_reader:l1:p:p3", readerOrigin: "forwarded_internal" });
    expect(alert?.reason).toBe("Repartagé en interne : Paul lit votre proposition");
  });

  it("ignores an anonymous clone of a known reader, reports another device", () => {
    const base = view("a", "x", { prospectId: "p1", ipHash: "net1" });
    const clone = view("b", "y", { ipHash: "net1" });
    expect(detectNewReader(mapOf([base, clone]), "l1", "b")).toBeNull();

    const phone = view("c", "z", { ipHash: "net1", deviceType: "mobile", os: "ios", browser: "safari" });
    expect(detectNewReader(mapOf([base, phone]), "l1", "c")?.reason).toBe("Nouveau lecteur probable (autre appareil)");

    const noNetwork = view("d", "w");
    expect(detectNewReader(mapOf([base, noNetwork]), "l1", "d")).toBeNull();
  });
});

describe("detectDecisionMaker", () => {
  it("flags finance passed the proposal", () => {
    const alert = detectDecisionMaker(mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p2" })]), "l1", "b");
    expect(alert).toMatchObject({ type: "DECISION_MAKER_DETECTED", dedupeKey: "decision_maker:l1:p2" });
    expect(alert?.reason).toBe("cfo@acme.fr (Finance / achats, détecté), à qui la proposition a été repartagée, lit votre proposition");
  });

  it("skips the main contact even when they are an executive", () => {
    const ceo = prospect("p1", "ceo@acme.fr", { origin: "SELLER", createdAt: ago(1000) });
    expect(detectDecisionMaker(mapOf([view("a", "x", { prospectId: "p1" })], [ceo]), "l1", "a")).toBeNull();
  });

  it("skips the first reader of a link the seller added nobody to", () => {
    const gateCfo = { ...cfo, createdAt: ago(1000) };
    expect(detectDecisionMaker(mapOf([view("a", "x", { prospectId: "p2" })], [gateCfo]), "l1", "a")).toBeNull();
  });

  it("skips a contact the seller added", () => {
    const addedCfo = { ...cfo, origin: "SELLER" as const };
    expect(detectDecisionMaker(mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p2" })], [anne, addedCfo]), "l1", "b")).toBeNull();
  });

  it("follows the seller tag", () => {
    const tagged = { ...paul, role: "DECISION_MAKER" as const };
    const map = mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p3" })], [anne, tagged]);
    expect(detectDecisionMaker(map, "l1", "b")?.reason).toContain("Décideur, tagué");
  });
});

describe("pickReaderAlert", () => {
  it("pushes the decision maker first and keeps the rest silent", () => {
    const map = mapOf([view("a", "x", { prospectId: "p1" }), view("b", "y", { prospectId: "p2" }), view("c", "z", { prospectId: "p3" })]);
    const candidates = [detectNewReader(map, "l1", "b"), detectCommittee(map, "l1", 3, now), detectDecisionMaker(map, "l1", "b")].filter(
      (a) => a !== null,
    );
    const { notify, silent } = pickReaderAlert(candidates);
    expect(notify?.type).toBe("DECISION_MAKER_DETECTED");
    expect(notify?.reason).toContain("avec 2 autres personnes en ce moment");
    expect(silent.map((a) => a.type)).toEqual(["COMMITTEE_LIVE", "NEW_READER"]);
  });

  it("returns nothing without candidates", () => {
    expect(pickReaderAlert([])).toEqual({ notify: null, silent: [] });
  });
});
