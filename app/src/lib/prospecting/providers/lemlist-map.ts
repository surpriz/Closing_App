// Lemlist request and response shapes (developer.lemlist.com, checked 11/10/2026). Pure.
import { normalizeLinkedinUrl, splitFullName } from "../dedupe";
import { searchKeywords, type TargetFilters } from "../target";
import type { Candidate, RevealDone, RevealInput } from "./types";

export const LEMLIST_PAGE_SIZE = 25;
/** Lemlist charges 5 credits for an email found (deliverable or risky), nothing otherwise. */
export const LEMLIST_EMAIL_CREDITS = 5;

/**
 * Filter ids of POST /api/database/people. Only "country" is documented; the others come from
 * GET /api/database/filters and stay null until checked there: those criteria then go
 * through the free-text search.
 */
export const LEMLIST_FILTERS = {
  country: "country",
  title: null as string | null,
  seniority: null as string | null,
} as const;

export function lemlistSearchBody(filters: TargetFilters, page: number) {
  const body: {
    filters: { filterId: string; in: string[]; out: string[] }[];
    page: number;
    size: number;
    search?: string;
  } = {
    filters: [{ filterId: LEMLIST_FILTERS.country, in: ["France"], out: [] }],
    page,
    size: LEMLIST_PAGE_SIZE,
  };

  const words = searchKeywords(filters).slice(0, 2);
  if (LEMLIST_FILTERS.title && filters.jobTitles.length) {
    body.filters.push({ filterId: LEMLIST_FILTERS.title, in: filters.jobTitles, out: [] });
  } else if (filters.jobTitles.length) {
    words.push(filters.jobTitles[0]);
  }
  if (LEMLIST_FILTERS.seniority && filters.seniorities.length) {
    body.filters.push({ filterId: LEMLIST_FILTERS.seniority, in: filters.seniorities, out: [] });
  }
  if (words.length) body.search = words.join(" ");
  return body;
}

type LemlistExperience = {
  company_name?: string | null;
  company_domain?: string | null;
  date_to?: string | null;
  main_in_profile?: boolean | null;
};

type LemlistPerson = {
  lead_id?: number | string | null;
  _id?: string | null;
  full_name?: string | null;
  title?: string | null;
  lead_linkedin_url?: string | null;
  current_exp_company_name?: string | null;
  experiences?: LemlistExperience[] | null;
};

function currentExperience(person: LemlistPerson) {
  const experiences = person.experiences ?? [];
  return experiences.find((e) => e.main_in_profile) ?? experiences.find((e) => !e.date_to) ?? null;
}

export function lemlistCandidates(body: { results?: LemlistPerson[] }): Candidate[] {
  return (body.results ?? []).flatMap((person) => {
    const id = person.lead_id ?? person._id;
    if (id === null || id === undefined) return [];
    const { first, last } = splitFullName(person.full_name);
    const experience = currentExperience(person);
    return [
      {
        externalId: String(id),
        firstName: first,
        lastName: last,
        lastNameIsMasked: false,
        title: person.title?.trim() || null,
        companyName: person.current_exp_company_name?.trim() || experience?.company_name?.trim() || null,
        companyDomain: experience?.company_domain?.toLowerCase().replace(/^www\./, "") || null,
        linkedinUrl: normalizeLinkedinUrl(person.lead_linkedin_url) ? person.lead_linkedin_url! : null,
      },
    ];
  });
}

export function lemlistHasMore(body: { total?: number | null; results?: unknown[] }, page: number) {
  if (typeof body.total === "number") return page * LEMLIST_PAGE_SIZE < body.total;
  return (body.results?.length ?? 0) >= LEMLIST_PAGE_SIZE;
}

/** Query string of POST /api/enrich: find (and verify) the professional email, nothing else. */
export function lemlistEnrichParams(input: RevealInput) {
  const params = new URLSearchParams({ findEmail: "true" });
  const set = (key: string, value: string | null) => value && params.set(key, value);
  set("linkedinUrl", input.linkedinUrl);
  set("firstName", input.firstName);
  set("lastName", input.lastName);
  set("companyName", input.companyName);
  set("companyDomain", input.companyDomain);
  return params;
}

/** GET /api/enrich/{id} once done (HTTP 200). Lemlist's finder only returns emails it verified. */
export function lemlistRevealOutcome(
  input: RevealInput,
  body: { data?: { email?: { email?: string | null; notFound?: boolean | null; status?: string | null } | null } | null },
): RevealDone {
  const found = body.data?.email;
  const email = found && !found.notFound ? found.email?.trim().toLowerCase() || null : null;
  return {
    state: "done",
    externalId: input.externalId,
    email,
    emailStatus: found?.status ?? (email ? "found" : "not_found"),
    verified: !!email,
    lastName: input.lastName,
    linkedinUrl: input.linkedinUrl,
    companyDomain: email ? email.split("@")[1] : input.companyDomain,
    credits: email ? LEMLIST_EMAIL_CREDITS : 0,
    estimated: true,
  };
}
