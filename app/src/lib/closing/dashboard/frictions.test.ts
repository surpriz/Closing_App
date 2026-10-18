import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/i18n/messages";

import { buildDocumentFrictions as build, type DocumentFrictionInput } from "./frictions";

const t = createTranslator({ locale: "fr", messages: MESSAGES.fr });
const buildDocumentFrictions = (input: DocumentFrictionInput) => build(input, t);

const base: DocumentFrictionInput = {
  numPages: 10,
  pages: [{ pageNumber: 7, tags: ["PRICING"], summary: "Prix et options" }],
  deals: [],
  aiFrictions: [],
};

describe("buildDocumentFrictions", () => {
  it("spots the page where several prospects stop", () => {
    const lines = buildDocumentFrictions({
      ...base,
      deals: [{ furthestPage: 7 }, { furthestPage: 7 }, { furthestPage: 10 }, { furthestPage: null }],
    });
    expect(lines).toEqual(["2 prospects sur 3 s'arrêtent à la page 7 (tarifs) : la suite n'est pas lue."]);
  });

  it("says when everyone read to the end", () => {
    expect(buildDocumentFrictions({ ...base, deals: [{ furthestPage: 10 }, { furthestPage: 10 }] })).toEqual([
      "Les 2 prospects qui ont ouvert sont allés jusqu'au bout.",
    ]);
  });

  it("stays silent on a single deal or scattered stops", () => {
    expect(buildDocumentFrictions({ ...base, deals: [{ furthestPage: 3 }] })).toEqual([]);
    expect(buildDocumentFrictions({ ...base, deals: [{ furthestPage: 3 }, { furthestPage: 5 }] })).toEqual([]);
  });

  it("counts frictions the analysis found on several deals, once per deal", () => {
    const lines = buildDocumentFrictions({
      ...base,
      aiFrictions: [["PRICE", "PRICE"], ["PRICE", "TIMING"], ["TIMING"], ["TRUST"]],
    });
    expect(lines).toEqual([
      "L'analyse voit le prix comme un frein chez 2 prospects.",
      "L'analyse voit le calendrier comme un frein chez 2 prospects.",
    ]);
    const en = createTranslator({ locale: "en", messages: MESSAGES.en });
    expect(build({ ...base, aiFrictions: [["PRICE"], ["PRICE"]] }, en)).toEqual([
      "The analysis sees price as a blocker for 2 prospects.",
    ]);
  });
});
