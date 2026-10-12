import { describe, expect, it } from "vitest";

import { EMPTY_TARGET } from "../target";
import { apolloCandidates, apolloHasMore, apolloRevealBody, apolloRevealOutcomes, apolloSearchParams } from "./apollo-map";

describe("apolloSearchParams", () => {
  it("turns the target into Apollo filters", () => {
    const params = apolloSearchParams(
      {
        ...EMPTY_TARGET,
        keywords: ["agence web"],
        nafCodes: ["73.11Z"],
        headcountCodes: ["11", "12", "53"],
        regions: ["84"],
        departements: ["75"],
        jobTitles: ["CEO"],
        seniorities: ["owner", "director"],
      },
      2,
    );
    expect(params.get("page")).toBe("2");
    expect(params.getAll("person_titles[]")).toEqual(["CEO"]);
    expect(params.getAll("person_seniorities[]")).toEqual(["owner", "director"]);
    expect(params.getAll("organization_locations[]")).toEqual(["Auvergne-Rhône-Alpes, France", "Île-de-France, France"]);
    expect(params.getAll("organization_num_employees_ranges[]")).toEqual(["10,49", "10000,1000000"]);
    expect(params.getAll("q_organization_keyword_tags[]")).toEqual(["agence web", "marketing & advertising"]);
    expect(params.has("q_keywords")).toBe(false);
  });

  it("searches the whole country without a place", () => {
    expect(apolloSearchParams(EMPTY_TARGET, 1).getAll("organization_locations[]")).toEqual(["France"]);
  });
});

describe("apolloCandidates", () => {
  it("keeps the masked last name and no email", () => {
    expect(
      apolloCandidates({
        people: [{ id: "p1", first_name: "Hélène", last_name_obfuscated: "Hu***n", title: "CEO", organization: { name: "Acme" } }],
      }),
    ).toEqual([
      {
        externalId: "p1",
        firstName: "Hélène",
        lastName: "Hu***n",
        lastNameIsMasked: true,
        title: "CEO",
        companyName: "Acme",
        companyDomain: null,
        linkedinUrl: null,
      },
    ]);
  });

  it("knows when there are more pages", () => {
    expect(apolloHasMore({ total_entries: 60 }, 2)).toBe(true);
    expect(apolloHasMore({ total_entries: 50 }, 2)).toBe(false);
    expect(apolloHasMore({ people: [] }, 1)).toBe(false);
  });
});

describe("apollo reveal", () => {
  const inputs = ["p1", "p2", "p3"].map((externalId) => ({
    externalId,
    firstName: null,
    lastName: null,
    companyName: null,
    companyDomain: null,
    linkedinUrl: null,
  }));

  it("never asks for personal emails or phones", () => {
    expect(apolloRevealBody(inputs.slice(0, 1))).toEqual({
      details: [{ id: "p1" }],
      reveal_personal_emails: false,
      reveal_phone_number: false,
    });
  });

  it("never matches by position", () => {
    const [outcome] = apolloRevealOutcomes(inputs.slice(0, 1), { matches: [{ id: "someone-else", email: "x@acme.fr" }] });
    expect([outcome.email, outcome.credits]).toEqual([null, 0]);
  });

  it("trusts only verified emails and charges only found people", () => {
    const outcomes = apolloRevealOutcomes(inputs, {
      matches: [
        { id: "p1", email: "Marie@Acme.fr", email_status: "verified", last_name: "Dupont", organization: { primary_domain: "acme.fr" } },
        { id: "p2", email: "jean@acme.fr", email_status: "guessed" },
        null,
      ],
    });
    expect(outcomes.map((o) => [o.email, o.verified, o.credits])).toEqual([
      ["marie@acme.fr", true, 1],
      ["jean@acme.fr", false, 1],
      [null, false, 0],
    ]);
    expect(outcomes[0].companyDomain).toBe("acme.fr");
  });
});
