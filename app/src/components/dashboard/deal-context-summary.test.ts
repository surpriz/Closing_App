import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/i18n/messages";

import { dealContextSummary } from "./deal-context-summary";

const fr = createTranslator({ locale: "fr", messages: MESSAGES.fr, namespace: "deal.dealContextSummary" });
const en = createTranslator({ locale: "en", messages: MESSAGES.en, namespace: "deal.dealContextSummary" });

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
      }, "fr", fr)),
    ).toBe("12 000 € · décision avant le 30 oct. · Marie Dupont (DAF)");
  });

  it("speaks English too", () => {
    expect(
      dealContextSummary(
        {
          amountCents: 1_200_000,
          currency: "USD",
          decisionDeadline: new Date(Date.UTC(2026, 9, 30, 12)),
          decisionMakerName: null,
          decisionMakerRole: null,
        },
        "en",
        en,
      ),
    ).toBe("$12,000 · decision by Oct 30");
  });

  it("skips what is not filled in", () => {
    expect(dealContextSummary({ amountCents: null, currency: null, decisionDeadline: null, decisionMakerName: "Marie Dupont", decisionMakerRole: null }, "fr", fr)).toBe(
      "Marie Dupont",
    );
    expect(dealContextSummary({ amountCents: null, currency: null, decisionDeadline: null, decisionMakerName: null, decisionMakerRole: "DAF" }, "fr", fr)).toBe(
      "DAF",
    );
    expect(dealContextSummary({ amountCents: null, currency: null, decisionDeadline: null, decisionMakerName: null, decisionMakerRole: null }, "fr", fr)).toBeNull();
  });
});
