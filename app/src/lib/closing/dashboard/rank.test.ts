import { describe, expect, it } from "vitest";

import type { NextAction } from "./next-action";
import { compareDeals } from "./rank";

const row = (name: string, action: NextAction, aiPriority: number | null, score = 50) => ({
  name,
  action,
  aiPriority,
  score,
  lastActivityAt: null,
});
const wait: NextAction = { kind: "wait", days: 1, opened: true, tier: "WARM" };
const order = (rows: ReturnType<typeof row>[]) => [...rows].sort(compareDeals).map((r) => r.name);

describe("compareDeals", () => {
  it("keeps real-time work first, whatever the AI priority", () => {
    expect(
      order([row("ai5", wait, 5), row("draft", { kind: "review_draft" }, null), row("live", { kind: "call_now" }, 1)]),
    ).toEqual(["live", "draft", "ai5"]);
  });

  it("lets the AI reorder deals the rules saw as equal", () => {
    expect(order([row("calm", wait, 2), row("stalling", wait, 4), row("no-ai", wait, null)])).toEqual([
      "stalling",
      "calm",
      "no-ai",
    ]);
  });

  it("mixes analysed and rule-only deals on one scale", () => {
    expect(order([row("ai2", wait, 2), row("call", { kind: "call", pricing: true }, null)])).toEqual(["call", "ai2"]);
  });

  it("leaves snoozed deals at the bottom", () => {
    expect(order([row("snoozed", { kind: "snoozed", until: new Date() }, 5), row("ai1", wait, 1)])).toEqual([
      "ai1",
      "snoozed",
    ]);
  });

  it("breaks ties with the measured score", () => {
    expect(order([row("cold", wait, 3, 20), row("hot", wait, 3, 80)])).toEqual(["hot", "cold"]);
  });
});
