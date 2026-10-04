import { describe, expect, it } from "vitest";

import { buildTodayHeadline, type TodayHeadlineInput } from "./today-headline";

const base: TodayHeadlineInput = {
  hotProspects: [],
  warmCount: 0,
  changeRequests: [],
  freshValidations: [],
  activeCount: 4,
  documentCount: 2,
  unopenedCount: 0,
  nextFollowupLabel: null,
};

describe("buildTodayHeadline", () => {
  it("leads with a fresh validation", () => {
    expect(
      buildTodayHeadline({ ...base, freshValidations: ["Acme"], hotProspects: ["Lumen"] }),
    ).toEqual({ headline: "Acme a validé.", hint: "Appelez Lumen en premier." });
  });

  it("groups several validations", () => {
    expect(buildTodayHeadline({ ...base, freshValidations: ["Acme", "Lumen", "Norda"] }).headline).toBe(
      "Acme et 2 autres ont validé.",
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
      headline: "3 prospects consultent vos documents.",
      hint: "Rien d'urgent. Prochaine relance demain à 09:00.",
    });
  });

  it("says when nothing has been opened yet", () => {
    expect(buildTodayHeadline({ ...base, activeCount: 2, unopenedCount: 2 }).headline).toBe(
      "Aucun lien n'a encore été ouvert.",
    );
  });

  it("invites to create a link when documents exist but none is sent", () => {
    expect(buildTodayHeadline({ ...base, activeCount: 0, documentCount: 1 })).toEqual({
      headline: "Votre document est prêt.",
      hint: "Créez un lien pour l'envoyer à un prospect.",
    });
  });

  it("invites to import when there is no document at all", () => {
    expect(buildTodayHeadline({ ...base, activeCount: 0, documentCount: 0 }).headline).toBe(
      "Aucun document pour l'instant.",
    );
  });

  it("falls back to a quiet day", () => {
    expect(buildTodayHeadline({ ...base, unopenedCount: 1 })).toEqual({
      headline: "Rien d'urgent aujourd'hui.",
      hint: "Clozer prépare les relances quand il le faut.",
    });
  });
});

describe("with the deal analysis", () => {
  it("leads with the deal the analysis ranks most urgent, after answers owed", () => {
    expect(
      buildTodayHeadline({
        ...base,
        hotProspects: ["Lumen"],
        aiFocus: { label: "Acme", headline: "Le DAF entre dans la boucle." },
        draftsToReview: 2,
      }),
    ).toEqual({ headline: "Acme : le DAF entre dans la boucle.", hint: "2 relances attendent votre accord." });
    expect(
      buildTodayHeadline({ ...base, changeRequests: ["Lumen"], aiFocus: { label: "Acme", headline: "X." } }).headline,
    ).toBe("Lumen demande un ajustement.");
  });

  it("points at drafts waiting on a quiet day", () => {
    expect(buildTodayHeadline({ ...base, draftsToReview: 1 }).hint).toBe("Une relance attend votre accord.");
  });
});
