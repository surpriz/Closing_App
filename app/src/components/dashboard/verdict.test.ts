import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/i18n/messages";

import { dealVerdict } from "./verdict";

const labels = createTranslator({ locale: "fr", messages: MESSAGES.fr });
const en = createTranslator({ locale: "en", messages: MESSAGES.en });

describe("dealVerdict", () => {
  it("lets the AI reading speak when there is one", () => {
    expect(
      dealVerdict(
        {
          insight: { headline: "Le prospect a tout lu et ouvert votre agenda.", summary: "Signal d'intérêt concret." },
          score: { tier: "WARM", score: 46, reasons: [{ code: "recent_activity_24h", weight: 25 }] },
          opened: true,
        },
        labels,
      ),
    ).toEqual({ headline: "Le prospect a tout lu et ouvert votre agenda.", detail: "Signal d'intérêt concret." });
  });

  it("says the link is not opened yet", () => {
    expect(dealVerdict({ insight: null, score: null, opened: false }, labels)).toEqual({
      headline: "Pas encore ouvert.",
      detail: "Le verdict arrive dès la première lecture.",
    });
  });

  it("falls back to the temperature with its two strongest reasons", () => {
    expect(
      dealVerdict(
        {
          insight: null,
          score: {
            tier: "WARM",
            score: 46,
            reasons: [
              { code: "pricing_focus", weight: 7 },
              { code: "recent_activity_24h", weight: 25 },
              { code: "repeat_visits", weight: 12 },
            ],
          },
          opened: true,
        },
        labels,
      ),
    ).toEqual({ headline: "Tiède : lu dans les dernières 24 h, visites répétées.", detail: null });
    expect(dealVerdict({ insight: null, score: { tier: "COLD", score: 0, reasons: [] }, opened: true }, en).headline).toBe(
      "Cold: no recent read.",
    );
  });

  it("keeps a code it has no label for", () => {
    expect(
      dealVerdict({ insight: null, score: { tier: "COLD", score: 3, reasons: [{ code: "mystery", weight: 3 }] }, opened: true }, labels),
    ).toEqual({ headline: "Froid : mystery.", detail: null });
  });

  it("explains a score without reasons, and an opened link without a score", () => {
    expect(dealVerdict({ insight: null, score: { tier: "COLD", score: 0, reasons: [] }, opened: true }, labels)).toEqual({
      headline: "Froid : aucune lecture récente.",
      detail: null,
    });
    expect(dealVerdict({ insight: null, score: null, opened: true }, labels)).toEqual({
      headline: "Ouvert.",
      detail: "Le verdict arrive dès que Clozer a analysé ce prospect.",
    });
  });
});
