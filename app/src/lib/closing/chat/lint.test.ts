import { describe, expect, it } from "vitest";

import { lintChatAnswer } from "./lint";

const source = "Total : 12 000,00 € HT. Acompte de 30 %. Offre valable jusqu'au 15 novembre.";

describe("lintChatAnswer", () => {
  it("accepts figures and dates quoted from the document", () => {
    expect(lintChatAnswer("Le total est de 12 000 € HT, avec un acompte de 30 %, valable jusqu'au 15 novembre.", source)).toEqual([]);
  });

  it("flags an amount the document never states", () => {
    expect(lintChatAnswer("Avec la remise, ce serait 10 500 €.", source)).toContain("invented_figure");
  });

  it("accepts k€ for an amount stated in full", () => {
    expect(lintChatAnswer("Environ 12 k€ au total.", source)).toEqual([]);
  });

  it("flags an invented date", () => {
    expect(lintChatAnswer("Livraison prévue le 3 décembre.", source)).toContain("invented_date");
  });

  it("lets the assistant point to a page", () => {
    expect(lintChatAnswer("Tout est détaillé page 3.", source)).toEqual([]);
  });

  it("flags a hint that reading is tracked", () => {
    expect(lintChatAnswer("I noticed you spent time on the pricing.", source)).toContain("tracking_hint");
  });
});
