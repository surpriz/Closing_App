// Fake provider for local tests without spending credits (PROSPECTING_MOCK=true, never in production).
import type { TargetFilters } from "../target";
import type { Candidate, ProspectingProvider, RevealInput, RevealOutcome } from "./types";

const FIRST = ["Marie", "Thomas", "Camille", "Nicolas", "Julie", "Antoine", "Sarah", "Pierre"];
const LAST = ["Martin", "Bernard", "Durand", "Lefebvre", "Moreau", "Laurent"];
const COMPANIES = ["Octo Technology", "Ippon Technologies", "Theodo", "Zenika", "Sfeir", "Wefox"];

function candidate(index: number, filters: TargetFilters): Candidate {
  const company = COMPANIES[index % COMPANIES.length];
  return {
    externalId: `mock-${index}`,
    firstName: FIRST[index % FIRST.length],
    lastName: LAST[index % LAST.length],
    lastNameIsMasked: false,
    title: filters.jobTitles[index % Math.max(1, filters.jobTitles.length)] ?? "Directeur général",
    companyName: company,
    companyDomain: `${company.toLowerCase().replace(/[^a-z]/g, "")}.example`,
    linkedinUrl: null,
  };
}

export function mockProvider(): ProspectingProvider {
  return {
    name: "MOCK",
    async searchPeople(filters, page) {
      const candidates = Array.from({ length: 10 }, (_, i) => candidate((page - 1) * 10 + i, filters));
      return { candidates, hasMore: page < 3, credits: 0, estimated: false };
    },
    async startReveal(inputs) {
      return inputs.map((input, i): RevealOutcome =>
        i % 3 === 2 ? { state: "pending", externalId: input.externalId, jobId: `job-${input.externalId}` } : done(input),
      );
    },
    async pollReveal(_jobId, input) {
      return done(input);
    },
  };
}

function done(input: RevealInput): RevealOutcome {
  const found = !input.externalId.endsWith("7");
  return {
    state: "done",
    externalId: input.externalId,
    email: found ? `${(input.firstName ?? "x").toLowerCase()}@${input.companyDomain ?? "example.com"}` : null,
    emailStatus: found ? "verified" : null,
    verified: found,
    lastName: input.lastName,
    linkedinUrl: null,
    companyDomain: input.companyDomain,
    credits: found ? 1 : 0,
    estimated: false,
  };
}
