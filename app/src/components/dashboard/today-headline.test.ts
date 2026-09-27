import { describe, expect, it } from "vitest";

import { buildTodayHeadline, type TodayHeadlineInput } from "./today-headline";

const base: TodayHeadlineInput = {
  hotProspects: [],
  warmCount: 0,
  changeRequests: [],
  freshValidations: [],
  activeCount: 4,
  unopenedCount: 0,
  nextFollowupLabel: null,
};

describe("buildTodayHeadline", () => {
  it("leads with a fresh validation", () => {
    expect(
      buildTodayHeadline({ ...base, freshValidations: ["Acme"], hotProspects: ["Lumen"] }),
    ).toEqual({ headline: "Acme a validé son devis.", hint: "Appelez Lumen en premier." });
  });

  it("groups several validations", () => {
    expect(buildTodayHeadline({ ...base, freshValidations: ["Acme", "Lumen", "Norda"] }).headline).toBe(
      "Acme et 2 autres ont validé leur devis.",
    );
  });

  it("puts change requests before hot prospects", () => {
    expect(buildTodayHeadline({ ...base, changeRequests: ["Acme"], hotProspects: ["Lumen"] })).toEqual({
      headline: "Acme demande un ajustement.",
      hint: "Répondez-lui aujourd'hui.",
    });
  });

  it("names the hottest prospect", () => {
    expect(buildTodayHeadline({ ...base, hotProspects: ["Acme", "Lumen"] })).toEqual({
      headline: "2 prospects sont chauds.",
      hint: "Appelez Acme en premier.",
    });
    expect(buildTodayHeadline({ ...base, hotProspects: ["Acme"] }).headline).toBe("Acme est chaud.");
  });

  it("stays calm when prospects are only warm", () => {
    expect(buildTodayHeadline({ ...base, warmCount: 3, nextFollowupLabel: "demain à 09:00" })).toEqual({
      headline: "3 prospects lisent vos devis.",
      hint: "Rien d'urgent. Prochaine relance demain à 09:00.",
    });
  });

  it("says when nothing has been opened yet", () => {
    expect(buildTodayHeadline({ ...base, activeCount: 2, unopenedCount: 2 }).headline).toBe(
      "Aucun devis n'a encore été ouvert.",
    );
  });

  it("invites to create a link when nothing is in progress", () => {
    expect(buildTodayHeadline({ ...base, activeCount: 0 }).headline).toBe("Aucun devis en cours.");
  });

  it("falls back to a quiet day", () => {
    expect(buildTodayHeadline({ ...base, unopenedCount: 1 })).toEqual({
      headline: "Rien d'urgent aujourd'hui.",
      hint: "Les relances partent toutes seules.",
    });
  });
});
