import { describe, expect, it } from "vitest";

import { buildReaderMap, type ReaderProspect, type ReaderView } from "./reader-map";

const now = new Date(Date.UTC(2026, 9, 9, 10, 0));
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

let seq = 0;
const view = (visitorId: string, extra: Partial<ReaderView> = {}): ReaderView => ({
  id: `v${++seq}`,
  linkId: "l1",
  visitorId,
  prospectId: null,
  email: null,
  ipHash: null,
  deviceType: "desktop",
  browser: "chrome",
  os: "macos",
  startedAt: ago(60),
  lastSeenAt: ago(50),
  leftAt: ago(50),
  totalDurationMs: 60_000,
  ...extra,
});

const prospect = (id: string, email: string, extra: Partial<ReaderProspect> = {}): ReaderProspect => ({
  id,
  email,
  name: null,
  role: null,
  origin: "SELLER",
  createdAt: ago(1000),
  ...extra,
});

const anne = prospect("p1", "anne@acme.fr", { name: "Anne Martin" });

describe("buildReaderMap", () => {
  it("counts one person for the same email on two browsers", () => {
    const map = buildReaderMap({
      views: [view("chrome", { prospectId: "p1", totalDurationMs: 1000 }), view("safari", { email: "anne@acme.fr", totalDurationMs: 2000 })],
      prospects: [anne],
      now,
    });
    expect(map.persons).toHaveLength(1);
    expect(map.persons[0]).toMatchObject({ label: "Anne Martin", origin: "initial", totalDurationMs: 3000 });
  });

  it("folds an anonymous session into the contact that browser later became", () => {
    const map = buildReaderMap({
      views: [view("chrome", { startedAt: ago(90) }), view("chrome", { prospectId: "p1", startedAt: ago(30) })],
      prospects: [anne],
      now,
    });
    expect(map.persons).toHaveLength(1);
    expect(map.persons[0].firstReadAt).toEqual(ago(90));
  });

  it("tells an internal forward from an outside reader", () => {
    const map = buildReaderMap({
      views: [
        view("a", { prospectId: "p1" }),
        view("b", { prospectId: "p2" }),
        view("c", { prospectId: "p3" }),
      ],
      prospects: [
        anne,
        prospect("p2", "cfo@acme.fr", { origin: "EMAIL_GATE" }),
        prospect("p3", "consultant@gmail.com", { origin: "EMAIL_GATE" }),
      ],
      now,
    });
    expect(map.persons.map((p) => p.origin)).toEqual(["initial", "forwarded_internal", "external"]);
    expect(map.persons[1].role).toEqual({ role: "FINANCE", source: "detected" });
  });

  it("groups anonymous readers with the company on the same network", () => {
    const map = buildReaderMap({
      views: [
        view("a", { prospectId: "p1", ipHash: "net1" }),
        view("b", { ipHash: "net1" }),
        view("c", { ipHash: "net2" }),
        view("d", { ipHash: "net2", deviceType: "mobile" }),
        view("e"),
      ],
      prospects: [anne],
      now,
    });
    expect(map.groups.map((g) => [g.label, g.persons.length])).toEqual([
      ["acme.fr", 2],
      ["Réseau non identifié 1", 2],
      ["Réseau inconnu", 1],
    ]);
    expect(map.groups[0].persons[1].viaNetwork).toBe(true);
  });

  it("makes the first reader the recipient when no contact read yet", () => {
    const map = buildReaderMap({ views: [view("x", { startedAt: ago(10) }), view("y", { startedAt: ago(5) })], prospects: [anne], now });
    expect(map.persons.map((p) => p.origin)).toEqual(["initial", "anonymous"]);
    expect(map.persons[0].label).toBe("Lecteur non identifié A");
  });

  it("takes the first reader's company as the recipient's when the seller added nobody", () => {
    const map = buildReaderMap({
      views: [view("a", { prospectId: "g1", startedAt: ago(30) }), view("b", { prospectId: "g2", startedAt: ago(10) })],
      prospects: [prospect("g1", "anne@acme.fr", { origin: "EMAIL_GATE" }), prospect("g2", "paul@acme.fr", { origin: "EMAIL_GATE" })],
      now,
    });
    expect(map.persons.map((p) => p.origin)).toEqual(["initial", "forwarded_internal"]);
  });

  it("knows who reads right now and who was seen recently", () => {
    const map = buildReaderMap({
      views: [
        view("a", { lastSeenAt: new Date(now.getTime() - 5_000), leftAt: null }),
        view("b", { lastSeenAt: ago(1), leftAt: ago(1) }),
        view("c", { lastSeenAt: ago(10) }),
      ],
      prospects: [],
      now,
    });
    expect(map.persons.map((p) => [p.readingNow, p.liveRecent])).toEqual([
      [true, true],
      [false, true],
      [false, false],
    ]);
  });
});
