import { describe, expect, it } from "vitest";

import { nameFromDomain, nameSimilarity, pickCompany } from "./match";

describe("nameSimilarity", () => {
  it("ignores legal forms, case and accents", () => {
    expect(nameSimilarity("Société Générale SA", "SOCIETE GENERALE")).toBe(1);
    expect(nameSimilarity("Acme Studio SAS", "acme studio")).toBe(1);
  });

  it("matches a domain label written as one word", () => {
    expect(nameSimilarity("acmestudio", "Acme Studio")).toBe(1);
  });

  it("is partial when only some words match", () => {
    expect(nameSimilarity("Acme Studio", "Acme Conseil")).toBe(0.5);
    expect(nameSimilarity("Acme", "Globex")).toBe(0);
  });
});

describe("pickCompany", () => {
  const candidates = [
    { siren: "111111111", names: ["ACME CONSEIL"], departement: "75" },
    { siren: "222222222", names: ["ACME STUDIO", "ACME"], departement: "69" },
  ];

  it("picks the closest name", () => {
    expect(pickCompany({ name: "Acme Studio" }, candidates)).toEqual({ siren: "222222222", confidence: 1 });
  });

  it("uses the departement to break a tie, else keeps the registry order", () => {
    const twins = [
      { siren: "111111111", names: ["ACME"], departement: "75" },
      { siren: "222222222", names: ["ACME"], departement: "69" },
    ];
    expect(pickCompany({ name: "Acme", departement: "69" }, twins)).toEqual({ siren: "222222222", confidence: 1 });
    // Two companies with the same name and nothing to tell them apart: a guess
    expect(pickCompany({ name: "Acme" }, twins)).toEqual({ siren: "111111111", confidence: 0.5 });
  });

  it("returns nothing when no name is close enough", () => {
    expect(pickCompany({ name: "Globex" }, candidates)).toBeNull();
  });
});

describe("nameFromDomain", () => {
  it("keeps the company label", () => {
    expect(nameFromDomain("www.acme-studio.fr")).toBe("acme studio");
    expect(nameFromDomain("acme.co.uk")).toBe("acme");
    expect(nameFromDomain("localhost")).toBeNull();
  });
});
