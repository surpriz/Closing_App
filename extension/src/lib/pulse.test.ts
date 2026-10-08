import { describe, expect, it } from "vitest";

import { alertsToShow, badgeText, pruneSnoozes, readerLine, rememberSeen, type PulseAlert, type PulseReader } from "./pulse";

const reader = (linkId: string, viewId = linkId): PulseReader => ({
  viewId,
  linkId,
  label: "Acme",
  name: "Léa Martin",
  currentPage: 4,
  startedAt: "2026-10-08T08:00:00Z",
});
const alert = (id: string, priority: PulseAlert["priority"], linkId = "l1"): PulseAlert => ({
  id,
  type: priority === "ACTION" ? "PROSPECT_VALIDATED" : "CALL_MOMENT",
  priority,
  linkId,
  url: `https://app/links/${linkId}`,
  title: "Acme lit votre proposition",
  body: "S'attarde sur les tarifs. C'est le moment d'appeler.",
  createdAt: "2026-10-08T08:00:00Z",
});

describe("badgeText", () => {
  it("counts deals being read, not browser tabs", () => {
    expect(badgeText([])).toBe("");
    expect(badgeText([reader("l1", "a"), reader("l1", "b"), reader("l2")])).toBe("2");
    expect(badgeText(Array.from({ length: 12 }, (_, i) => reader(`l${i}`)))).toBe("9+");
  });
});

describe("alertsToShow", () => {
  const state = { seen: [] as string[], snoozed: {} as Record<string, number>, callMoments: true };

  it("never shows the same alert twice", () => {
    expect(alertsToShow([alert("a", "CALL")], { ...state, seen: ["a"] }, 0)).toEqual([]);
  });

  it("holds call moments on a deal put off, not prospect actions", () => {
    const shown = alertsToShow([alert("a", "CALL"), alert("b", "ACTION")], { ...state, snoozed: { l1: 1000 } }, 500);
    expect(shown.map((a) => a.id)).toEqual(["b"]);
    expect(alertsToShow([alert("a", "CALL")], { ...state, snoozed: { l1: 1000 } }, 2000)).toHaveLength(1);
  });

  it("drops call moments when switched off in the popup", () => {
    const shown = alertsToShow([alert("a", "CALL"), alert("b", "ACTION")], { ...state, callMoments: false }, 0);
    expect(shown.map((a) => a.id)).toEqual(["b"]);
  });
});

describe("helpers", () => {
  it("keeps a bounded list of seen ids", () => {
    const seen = rememberSeen(Array.from({ length: 100 }, (_, i) => `x${i}`), ["new"]);
    expect(seen).toHaveLength(100);
    expect(seen.at(-1)).toBe("new");
  });

  it("forgets expired snoozes", () => {
    expect(pruneSnoozes({ l1: 10, l2: 30 }, 20)).toEqual({ l2: 30 });
  });

  it("names the reader and the page", () => {
    expect(readerLine(reader("l1"))).toBe("Acme · Léa Martin, page 4");
    expect(readerLine({ ...reader("l1"), name: null, currentPage: null })).toBe("Acme");
  });
});
