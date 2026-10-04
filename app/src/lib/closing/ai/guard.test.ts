import { describe, expect, it } from "vitest";

import { lintFollowup, parseNumber, type GuardContext } from "./guard";

const url = "https://app.clozer.club/v/abc123";
const ctx: GuardContext = {
  channel: "EMAIL",
  proposalUrl: url,
  sourceText: "Total : 12 000,00 € HT. Acompte de 30 %. Option B à 1 500 €. Offre valable jusqu'au 15 novembre.",
};
const codes = (body: string, subject: string | null = "Un point ?", context = ctx) =>
  lintFollowup({ subject, body }, context).map((issue) => issue.code);

const ok = `Bonjour Anne,\n\nSi l'enveloppe coince, on peut moduler certaines options. On en parle 15 minutes ?\n\n${url}\n\nJérôme`;

describe("lintFollowup", () => {
  it("passes a clean message", () => {
    expect(codes(ok)).toEqual([]);
  });

  it.each([
    "J'ai vu que vous repassiez sur la partie budget.",
    "Vous avez consulté la proposition hier soir.",
    "Je vois que tu repassais sur les tarifs.",
    "Le temps passé sur le devis montre votre intérêt.",
    "Concernant la page 7, des questions ?",
    "I noticed you spent some time on pricing.",
    "You've opened the proposal twice.",
    "He visto que has abierto la propuesta.",
    "Mir ist aufgefallen, dass Sie das Angebot gelesen haben.",
  ])("flags a tracking hint: %s", (sentence) => {
    expect(codes(`Bonjour,\n\n${sentence}\n\n${url}`)).toContain("tracking_hint");
  });

  it("does not read the URL as a page reference", () => {
    const pageUrl = "https://app.clozer.club/v/page-2";
    expect(codes(`Bonjour,\n\nLe document : ${pageUrl}`, null, { ...ctx, proposalUrl: pageUrl })).toEqual([]);
  });

  it("requires the link exactly once", () => {
    expect(codes("Bonjour, pas de lien.")).toContain("url");
    expect(codes(`${url}\n${url}`)).toContain("url");
  });

  it("accepts figures from the proposal, written differently", () => {
    expect(codes(`Le total de 12 000 € et l'acompte de 30 % restent négociables.\n${url}`)).toEqual([]);
    expect(codes(`L'option à 1500 € peut sauter.\n${url}`)).toEqual([]);
    expect(codes(`Soit 12k€ au total.\n${url}`)).toEqual([]);
  });

  it("flags an invented amount or discount", () => {
    expect(codes(`Je peux vous faire 10 % de remise.\n${url}`)).toContain("invented_figure");
    expect(codes(`Ce serait 9 500 € au lieu du total.\n${url}`)).toContain("invented_figure");
  });

  it("flags an invented date, accepts a stated one", () => {
    expect(codes(`L'offre court jusqu'au 15 novembre.\n${url}`)).toEqual([]);
    expect(codes(`L'offre expire le 3 décembre.\n${url}`)).toContain("invented_date");
  });

  it("flags placeholders, emojis in email and length", () => {
    expect(codes(`Bonjour [Prénom],\n${url}`)).toContain("placeholder");
    expect(codes(`Bonjour 🙂\n${url}`)).toContain("emoji");
    expect(codes(`Bonjour 🙂\n${url}`, null, { ...ctx, channel: "WHATSAPP" })).not.toContain("emoji");
    expect(codes(`${"a".repeat(1600)}\n${url}`)).toContain("length");
  });
});

describe("parseNumber", () => {
  it("reads French and English formats", () => {
    expect(parseNumber("12 000,00")).toBe(12000);
    expect(parseNumber("12.000")).toBe(12000);
    expect(parseNumber("14,500")).toBe(14500);
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("30")).toBe(30);
  });
});
