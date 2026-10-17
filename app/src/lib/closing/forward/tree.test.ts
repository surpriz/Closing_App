import { describe, expect, it } from "vitest";

import type { Person } from "../committee/reader-map";
import { buildForwardTree, hottestPages } from "./tree";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 17, 9, minutes));

const prospect = (id: string, origin: "SELLER" | "FORWARDED" | "EMAIL_GATE", forwardedById: string | null, minutes: number) => ({
  id,
  email: `${id}@acme.fr`,
  name: null,
  origin,
  forwardedById,
  createdAt: at(minutes),
});

function person(prospectId: string | null, overrides: Partial<Person> = {}): Person {
  return {
    key: prospectId ? `p:${prospectId}` : `v:${Math.random()}`,
    prospectId,
    email: prospectId ? `${prospectId}@acme.fr` : null,
    label: prospectId ?? "Lecteur non identifié",
    identified: !!prospectId,
    role: null,
    detectedRole: null,
    origin: prospectId ? "external" : "anonymous",
    forwardedBy: null,
    domain: null,
    viaNetwork: false,
    viewIds: ["v1", "v2"],
    ipHashes: [],
    deviceSignatures: [],
    firstReadAt: at(0),
    lastReadAt: at(5),
    totalDurationMs: 120_000,
    readingNow: false,
    liveRecent: false,
    ...overrides,
  };
}

const empty = { pagesByProspect: new Map(), actionsByProspect: new Map() };

describe("buildForwardTree", () => {
  it("hangs each forward under the reader who sent it, any depth", () => {
    const tree = buildForwardTree({
      ...empty,
      prospects: [prospect("manager", "SELLER", null, 0), prospect("n1", "FORWARDED", "manager", 10), prospect("n2", "FORWARDED", "n1", 20)],
      forwards: [
        { fromProspectId: "manager", toProspectId: "n1", message: "Ton avis ?", createdAt: at(10), sentAt: at(10), error: null },
        { fromProspectId: "n1", toProspectId: "n2", message: null, createdAt: at(20), sentAt: null, error: "bounce" },
      ],
      persons: [person("manager"), person("n1", { role: { role: "FINANCE", source: "detected" } })],
    });

    expect(tree.roots).toHaveLength(1);
    const [manager] = tree.roots;
    const [n1] = manager.children;
    expect(n1.label).toBe("n1@acme.fr");
    expect(n1.received).toMatchObject({ from: "manager@acme.fr", message: "Ton avis ?", delivered: true });
    expect(n1.decision).toBe(true);
    expect(n1.opened).toBe(true);
    const [n2] = n1.children;
    expect(n2.opened).toBe(false);
    expect(n2.received).toMatchObject({ delivered: false, failed: true });
    expect(tree.hasForwards).toBe(true);
  });

  it("groups readers who came without a known forwarder, and keeps what they forwarded under them", () => {
    const tree = buildForwardTree({
      ...empty,
      prospects: [prospect("seller", "SELLER", null, 0), prospect("gate", "EMAIL_GATE", null, 5), prospect("next", "FORWARDED", "gate", 9)],
      forwards: [{ fromProspectId: "gate", toProspectId: "next", message: null, createdAt: at(9), sentAt: at(9), error: null }],
      persons: [person("gate"), person(null), person(null)],
    });
    expect(tree.roots.map((n) => n.prospectId)).toEqual(["seller"]);
    expect(tree.offClozer.map((n) => n.prospectId)).toEqual(["gate"]);
    expect(tree.offClozer[0].children.map((n) => n.prospectId)).toEqual(["next"]);
    expect(tree.anonymous).toBe(2);
  });

  it("puts a recipient whose forwarder was deleted at the top", () => {
    const tree = buildForwardTree({ ...empty, prospects: [prospect("orphan", "FORWARDED", "gone", 0)], forwards: [], persons: [] });
    expect(tree.roots.map((n) => n.prospectId)).toEqual(["orphan"]);
    expect(tree.hasForwards).toBe(false);
  });

  it("still shows people caught in a loop of parents", () => {
    const tree = buildForwardTree({
      ...empty,
      prospects: [prospect("root", "SELLER", null, 0), prospect("a", "FORWARDED", "b", 1), prospect("b", "FORWARDED", "a", 2)],
      forwards: [],
      persons: [],
    });
    expect(tree.roots.map((n) => n.prospectId)).toEqual(["root", "a"]);
    expect(tree.roots[1].children.map((n) => n.prospectId)).toEqual(["b"]);
  });
});

describe("hottestPages", () => {
  it("keeps the longest-read pages, earlier page first on a tie", () => {
    expect(
      hottestPages([
        { pageNumber: 1, totalDurationMs: 5_000 },
        { pageNumber: 4, totalDurationMs: 60_000 },
        { pageNumber: 2, totalDurationMs: 5_000 },
        { pageNumber: 7, totalDurationMs: 30_000 },
        { pageNumber: 9, totalDurationMs: 0 },
      ]),
    ).toEqual([4, 7, 1]);
  });
});
