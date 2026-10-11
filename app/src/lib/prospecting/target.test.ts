import { describe, expect, it } from "vitest";

import {
  companyFit,
  describeTarget,
  EMPTY_TARGET,
  searchKeywords,
  seniorityFromTitle,
  splitList,
  targetFiltersSchema,
  targetIsSearchable,
} from "./target";

describe("splitList", () => {
  it("splits on commas, semicolons and lines", () => {
    expect(splitList("agence web, studio ;\n conseil,, ")).toEqual(["agence web", "studio", "conseil"]);
    expect(splitList(null)).toEqual([]);
  });
});

describe("targetFiltersSchema", () => {
  it("normalizes codes and drops unknown values", () => {
    const parsed = targetFiltersSchema.parse({
      ...EMPTY_TARGET,
      nafCodes: ["6201Z", "62.01Z", "nope"],
      headcountCodes: ["11", "99"],
      regions: ["84", "00"],
      departements: ["69", "2a", "1234"],
      seniorities: ["director", "intern"],
      excludedDomains: ["www.Acme.fr"],
    });
    expect(parsed.nafCodes).toEqual(["62.01Z"]);
    expect(parsed.headcountCodes).toEqual(["11"]);
    expect(parsed.regions).toEqual(["84"]);
    expect(parsed.departements).toEqual(["69", "2A"]);
    expect(parsed.seniorities).toEqual(["director"]);
    expect(parsed.excludedDomains).toEqual(["acme.fr"]);
  });
});

describe("targetIsSearchable", () => {
  it("needs a sector and people to look for", () => {
    expect(targetIsSearchable(EMPTY_TARGET)).toBe(false);
    expect(targetIsSearchable({ ...EMPTY_TARGET, keywords: ["agence web"] })).toBe(false);
    expect(targetIsSearchable({ ...EMPTY_TARGET, keywords: ["agence web"], seniorities: ["owner"] })).toBe(true);
  });
});

describe("describeTarget", () => {
  it("reads like a sentence", () => {
    expect(
      describeTarget({ ...EMPTY_TARGET, nafCodes: ["62.01Z", "62.02A"], headcountCodes: ["11", "12"], regions: ["84"] }),
    ).toBe("Programmation et conseil informatique · 10-49 salariés · Auvergne-Rhône-Alpes");
  });

  it("prefers the seller's own words", () => {
    expect(describeTarget({ ...EMPTY_TARGET, keywords: ["agences web"], nafCodes: ["62.01Z"] })).toBe("agences web");
  });
});

describe("searchKeywords", () => {
  it("adds NAF labels after the seller's words", () => {
    expect(searchKeywords({ ...EMPTY_TARGET, keywords: ["agence web"], nafCodes: ["73.11Z"] })).toEqual([
      "agence web",
      "Publicité et études de marché",
    ]);
  });
});

describe("companyFit", () => {
  const target = { ...EMPTY_TARGET, nafCodes: ["62.01Z"], regions: ["84"] };

  it("is unknown without registry data", () => {
    expect(companyFit(null, target)).toBe("unknown");
    expect(companyFit({ naf: null, region: "84", departement: "69" }, target)).toBe("unknown");
  });

  it("matches on the NAF division and the place", () => {
    expect(companyFit({ naf: "62.02A", region: "84", departement: "69" }, target)).toBe("match");
  });

  it("rejects another sector or another region", () => {
    expect(companyFit({ naf: "47.11F", region: "84", departement: "69" }, target)).toBe("off_target");
    expect(companyFit({ naf: "62.01Z", region: "11", departement: "75" }, target)).toBe("off_target");
  });

  it("accepts a listed departement outside the listed regions", () => {
    expect(companyFit({ naf: "62.01Z", region: "11", departement: "75" }, { ...target, departements: ["75"] })).toBe(
      "match",
    );
  });
});

describe("seniorityFromTitle", () => {
  it.each([
    ["Directeur Général", "c_suite"],
    ["PDG", "c_suite"],
    ["Co-founder & CEO", "founder"],
    ["Gérante", "owner"],
    ["Directrice commerciale", "director"],
    ["Head of Sales", "head"],
    ["Responsable marketing", "head"],
    ["Account manager", "manager"],
    ["Développeur", null],
  ])("%s → %s", (title, expected) => {
    expect(seniorityFromTitle(title)).toBe(expected);
  });
});
