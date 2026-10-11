import { describe, expect, it } from "vitest";

import { EMPTY_TARGET } from "../target";
import { lemlistCandidates, lemlistEnrichParams, lemlistRevealOutcome, lemlistSearchBody } from "./lemlist-map";

const input = {
  externalId: "42",
  firstName: "Marie",
  lastName: "Dupont",
  companyName: "Acme",
  companyDomain: "acme.fr",
  linkedinUrl: "https://www.linkedin.com/in/marie-dupont",
};

describe("lemlistSearchBody", () => {
  it("searches France and falls back to free text for undocumented filters", () => {
    expect(
      lemlistSearchBody({ ...EMPTY_TARGET, keywords: ["agence web"], jobTitles: ["CEO", "Gérant"] }, 2),
    ).toEqual({
      filters: [{ filterId: "country", in: ["France"], out: [] }],
      page: 2,
      size: 25,
      search: "agence web CEO",
    });
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
            title: "CEO",
            lead_linkedin_url: "https://www.linkedin.com/in/marie-dupont",
            experiences: [
              { company_name: "Old Co", company_domain: "old.fr", date_to: "2020-01" },
              { company_name: "Acme", company_domain: "www.Acme.fr", date_to: null },
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
