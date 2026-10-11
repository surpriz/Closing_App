// Apollo request and response shapes (docs.apollo.io, checked 11/10/2026). Pure.
import { placeNames } from "../geo";
import { headcountRanges } from "../headcount";
import { searchKeywords, type TargetFilters } from "../target";
import type { Candidate, RevealDone, RevealInput } from "./types";

export const APOLLO_PAGE_SIZE = 25;

/** Query string of POST /api/v1/mixed_people/api_search (0 credit, no email). */
export function apolloSearchParams(filters: TargetFilters, page: number) {
  const params = new URLSearchParams({ page: String(page), per_page: String(APOLLO_PAGE_SIZE) });
  for (const title of filters.jobTitles) params.append("person_titles[]", title);
  for (const seniority of filters.seniorities) params.append("person_seniorities[]", seniority);

  const places = placeNames(filters);
  for (const place of places.length ? places.map((p) => `${p}, France`) : ["France"]) {
    params.append("organization_locations[]", place);
  }
  for (const range of headcountRanges(filters.headcountCodes)) {
    params.append("organization_num_employees_ranges[]", `${range.min},${range.max ?? 1_000_000}`);
  }

  const keywords = searchKeywords(filters);
  if (keywords.length) params.set("q_keywords", keywords.slice(0, 3).join(" "));
  return params;
}

type ApolloSearchPerson = {
  id: string;
  first_name?: string | null;
  last_name_obfuscated?: string | null;
  title?: string | null;
  organization?: { name?: string | null } | null;
};

export function apolloCandidates(body: { people?: ApolloSearchPerson[] }): Candidate[] {
  return (body.people ?? []).map((person) => ({
    externalId: person.id,
    firstName: person.first_name?.trim() || null,
    lastName: person.last_name_obfuscated?.trim() || null,
    lastNameIsMasked: true,
    title: person.title?.trim() || null,
    companyName: person.organization?.name?.trim() || null,
    companyDomain: null,
    linkedinUrl: null,
  }));
}

export function apolloHasMore(
  body: { people?: unknown[]; total_entries?: number | null; pagination?: { total_pages?: number } | null },
  page: number,
) {
  if (typeof body.pagination?.total_pages === "number") return page < body.pagination.total_pages;
  if (typeof body.total_entries === "number") return page * APOLLO_PAGE_SIZE < body.total_entries;
  return (body.people?.length ?? 0) >= APOLLO_PAGE_SIZE;
}

/** Body of POST /api/v1/people/bulk_match: at most 10 people, never personal emails nor phones. */
export function apolloRevealBody(inputs: RevealInput[]) {
  return {
    details: inputs.map((input) => ({ id: input.externalId })),
    reveal_personal_emails: false,
    reveal_phone_number: false,
  };
}

type ApolloMatch = {
  id?: string | null;
  email?: string | null;
  email_status?: string | null;
  last_name?: string | null;
  linkedin_url?: string | null;
  organization?: { primary_domain?: string | null } | null;
} | null;

/**
 * One outcome per input, matched by id only: a position could hand one person's email to
 * another. Apollo charges 1 credit when it returns a person, 0 when nothing is found; only
 * "verified" is trusted, the other statuses are guesses.
 */
export function apolloRevealOutcomes(inputs: RevealInput[], body: { matches?: ApolloMatch[] }): RevealDone[] {
  const matches = body.matches ?? [];
  return inputs.map((input) => {
    const match = matches.find((m) => m?.id === input.externalId) ?? null;
    return {
      state: "done",
      externalId: input.externalId,
      email: match?.email?.trim().toLowerCase() || null,
      emailStatus: match?.email_status ?? null,
      verified: match?.email_status === "verified",
      lastName: match?.last_name?.trim() || null,
      linkedinUrl: match?.linkedin_url || null,
      companyDomain: match?.organization?.primary_domain?.toLowerCase() || null,
      credits: match ? 1 : 0,
      estimated: true,
    };
  });
}
