import { describe, expect, it } from "vitest";

import { dealWeight, inferTarget, type DealCompany } from "./aggregate";

const deal = (domain: string, company: Partial<NonNullable<DealCompany["company"]>> | null, patch: Partial<DealCompany> = {}): DealCompany => ({
  domain,
  company: company && { naf: null, headcountCode: null, region: null, departement: null, ...company },
  confidence: 1,
  score: 0,
  won: false,
  ...patch,
});

describe("dealWeight", () => {
  it("rewards engagement and won deals, scaled by confidence", () => {
    expect(dealWeight({ score: 0, won: false, confidence: 1 })).toBe(1);
    expect(dealWeight({ score: 100, won: false, confidence: 1 })).toBe(3);
    expect(dealWeight({ score: 100, won: true, confidence: 0.5 })).toBe(2.5);
  });
});

describe("inferTarget", () => {
  it("describes the customers that matter most", () => {
    const target = inferTarget([
      deal("a.fr", { naf: "62.01Z", headcountCode: "11", region: "84", departement: "69" }, { won: true }),
      deal("b.fr", { naf: "62.01Z", headcountCode: "12", region: "84", departement: "38" }, { score: 80 }),
      deal("c.fr", { naf: "73.11Z", headcountCode: "12", region: "84", departement: "69" }, { score: 20 }),
      deal("d.fr", { naf: "47.11F", headcountCode: "53", region: "11", departement: "75" }, { confidence: 0.5 }),
      deal("gmail-like.fr", null),
    ]);

    expect(target.nafCodes).toEqual(["62.01Z", "73.11Z"]);
    expect(target.headcountCodes).toEqual(["11", "12"]);
    expect(target.regions).toEqual(["84"]);
    expect(target.departements).toEqual([]);
    expect(target.evidence).toEqual({ domains: 5, recognized: 4, won: 1, averageConfidence: 0.88 });
  });

  it("keeps the main sector when every sector is a small share", () => {
    const sectors = ["62.01Z", "73.11Z", "70.22Z", "71.12B", "69.20Z", "47.11F", "43.21A"];
    const target = inferTarget(sectors.map((naf, i) => deal(`${i}.fr`, { naf }, { score: i === 3 ? 50 : 0 })));
    expect(target.nafCodes).toEqual(["71.12B"]);
  });

  it("falls back to departements when no region stands out", () => {
    const target = inferTarget([
      deal("a.fr", { naf: "62.01Z", region: "84", departement: "69" }),
      deal("b.fr", { naf: "62.01Z", region: "11", departement: "75" }),
      deal("c.fr", { naf: "62.01Z", region: "93", departement: "13" }),
      deal("d.fr", { naf: "62.01Z", region: "75", departement: "33" }),
      deal("e.fr", { naf: "62.01Z", region: "53", departement: "35" }),
    ]);
    expect(target.regions).toEqual([]);
    expect(target.departements).toEqual(["13", "33", "35", "69", "75"]);
  });

  it("gives an empty target without recognized companies", () => {
    expect(inferTarget([deal("a.fr", null)])).toEqual({
      nafCodes: [],
      headcountCodes: [],
      regions: [],
      departements: [],
      evidence: { domains: 1, recognized: 0, won: 0, averageConfidence: null },
    });
  });
});
