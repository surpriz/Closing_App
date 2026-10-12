import { describe, expect, it } from "vitest";

import { EMPTY_TARGET } from "../target";
import {
  lemlistCandidates,
  lemlistEnrichParams,
  lemlistHasMore,
  lemlistHeadcounts,
  lemlistRevealOutcome,
  lemlistSearchBody,
} from "./lemlist-map";

const input = {
  externalId: "42",
  firstName: "Marie",
  lastName: "Dupont",
  companyName: "Acme",
  companyDomain: "acme.fr",
  linkedinUrl: "https://www.linkedin.com/in/marie-dupont",
};

describe("lemlistSearchBody", () => {
  it("uses the filter ids of the people database", () => {
    expect(
      lemlistSearchBody(
        {
          ...EMPTY_TARGET,
          keywords: ["agence web"],
          nafCodes: ["73.11Z"],
          jobTitles: ["CEO"],
          seniorities: ["owner", "founder", "director"],
          headcountCodes: ["11", "12"],
          regions: ["84"],
        },
        2,
      ),
    ).toEqual({
      filters: [
        { filterId: "country", in: ["France"], out: [] },
        { filterId: "currentTitle", in: ["CEO"], out: [] },
        { filterId: "seniority", in: ["Ownership / Firm Leadership", "Department Leadership"], out: [] },
        { filterId: "currentCompanyHeadcount", in: ["11-50"], out: [] },
        { filterId: "currentCompanyLocation", in: ["Auvergne-Rhône-Alpes"], out: [] },
        { filterId: "keywordInCompany", in: ["agence web"], out: [] },
      ],
      page: 2,
      size: 25,
    });
  });

  it("falls back to the English industry without the seller's words", () => {
    const body = lemlistSearchBody({ ...EMPTY_TARGET, nafCodes: ["73.11Z"] }, 1);
    expect(body.filters.at(-1)).toEqual({ filterId: "keywordInCompany", in: ["marketing & advertising"], out: [] });
  });

  it("maps headcount brackets to every overlapping bucket", () => {
    expect(lemlistHeadcounts(["21", "22"])).toEqual(["51-200"]);
    expect(lemlistHeadcounts(["53"])).toEqual(["10001+"]);
  });

  it("reads the page size Lemlist actually used", () => {
    expect(lemlistHasMore({ total: 27, size: 1, results: [{}] }, 3)).toBe(true);
    expect(lemlistHasMore({ total: 3, size: 1, results: [{}] }, 3)).toBe(false);
  });
});

describe("lemlistCandidates", () => {
  it("reads the current company from the experiences", () => {
    expect(
      lemlistCandidates({
        results: [
          {
            lead_id: 42,
            full_name: "Marie Dupont",
            title: null,
            lead_linkedin_url: "https://www.linkedin.com/in/marie-dupont",
            experiences: [
              { company_name: "Old Co", company_domain: "old.fr", date_to: "2020-01" },
              { title: "CEO", company_name: "Acme", company_domain: "www.Acme.fr", date_to: null },
            ],
          },
          { full_name: "No Id" },
        ],
      }),
    ).toEqual([
      {
        externalId: "42",
        firstName: "Marie",
        lastName: "Dupont",
        lastNameIsMasked: false,
        title: "CEO",
        companyName: "Acme",
        companyDomain: "acme.fr",
        linkedinUrl: "https://www.linkedin.com/in/marie-dupont",
      },
    ]);
  });
});

describe("lemlist reveal", () => {
  it("asks only for the email", () => {
    const params = lemlistEnrichParams(input);
    expect(params.get("findEmail")).toBe("true");
    expect(params.has("findPhone")).toBe(false);
    expect(params.get("companyDomain")).toBe("acme.fr");
  });

  it("charges only a found email", () => {
    const found = lemlistRevealOutcome(input, { data: { email: { email: "Marie@Acme.fr", notFound: false } } });
    expect([found.email, found.verified, found.credits]).toEqual(["marie@acme.fr", true, 5]);

    const missing = lemlistRevealOutcome(input, { data: { email: { email: null, notFound: true } } });
    expect([missing.email, missing.verified, missing.credits]).toEqual([null, false, 0]);
  });
});
