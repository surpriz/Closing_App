import { describe, expect, it } from "vitest";

import { dealContextSummary } from "./deal-context-summary";

const plain = (text: string | null) => text?.replace(/[\u202f\u00a0]/g, " ") ?? null;

describe("dealContextSummary", () => {
  it("lines up the amount, the deadline and the decision maker", () => {
    expect(
      plain(dealContextSummary({
        amountCents: 1_200_000,
        currency: "EUR",
        decisionDeadline: new Date(Date.UTC(2026, 9, 30, 12)),
        decisionMakerName: "Marie Dupont",
        decisionMakerRole: "DAF",
      })),
    ).toBe("12 000 € · décision avant le 30 oct. · Marie Dupont (DAF)");
  });

  it("skips what is not filled in", () => {
    expect(dealContextSummary({ amountCents: null, currency: null, decisionDeadline: null, decisionMakerName: "Marie Dupont", decisionMakerRole: null })).toBe(
      "Marie Dupont",
    );
    expect(dealContextSummary({ amountCents: null, currency: null, decisionDeadline: null, decisionMakerName: null, decisionMakerRole: "DAF" })).toBe(
      "DAF",
    );
    expect(dealContextSummary({ amountCents: null, currency: null, decisionDeadline: null, decisionMakerName: null, decisionMakerRole: null })).toBeNull();
  });
});
