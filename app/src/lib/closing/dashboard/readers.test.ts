import { describe, expect, it } from "vitest";

import { labelReaders } from "./readers";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 4, 8, minutes));
const view = (id: string, visitorId: string, minutes: number, extra: Partial<Parameters<typeof labelReaders>[0][number]> = {}) => ({
  id,
  linkId: "l1",
  visitorId,
  startedAt: at(minutes),
  email: null,
  prospect: null,
  ...extra,
});

describe("labelReaders", () => {
  it("names known readers and letters anonymous browsers by first visit", () => {
    const labels = labelReaders([
      view("v3", "safari", 30),
      view("v1", "chrome", 0),
      view("v2", "chrome", 10),
      view("v4", "x", 40, { prospect: { name: "Anne Martin", email: "anne@acme.fr" } }),
    ]);
    expect(labels.get("v1")).toEqual({ name: "Lecteur non identifié A", identified: false });
    expect(labels.get("v2")?.name).toBe("Lecteur non identifié A");
    expect(labels.get("v3")?.name).toBe("Lecteur non identifié B");
    expect(labels.get("v4")).toEqual({ name: "Anne Martin", identified: true });
  });

  it("restarts letters on each link", () => {
    const labels = labelReaders([view("a", "v", 0), view("b", "w", 1, { linkId: "l2" })]);
    expect(labels.get("b")?.name).toBe("Lecteur non identifié A");
  });
});
