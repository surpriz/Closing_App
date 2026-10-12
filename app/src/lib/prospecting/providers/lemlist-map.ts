// Lemlist request and response shapes (developer.lemlist.com + GET /api/database/filters,
// checked live 12/10/2026). Pure.
import { normalizeLinkedinUrl, splitFullName } from "../dedupe";
import { placeNames } from "../geo";
import { headcountRanges } from "../headcount";
import { searchKeywords, type Seniority, type TargetFilters } from "../target";
import type { Candidate, RevealDone, RevealInput } from "./types";

export const LEMLIST_PAGE_SIZE = 25;
/** Lemlist charges 5 credits for an email found (deliverable or risky), nothing otherwise. */
export const LEMLIST_EMAIL_CREDITS = 5;

const LEMLIST_SENIORITY: Record<Seniority, string> = {
  owner: "Ownership / Firm Leadership",
  founder: "Ownership / Firm Leadership",
  partner: "Ownership / Firm Leadership",
  c_suite: "Executive Leadership",
  vp: "Executive Leadership",
  head: "Department Leadership",
  director: "Department Leadership",
  manager: "People Management / Leadership",
};

const LEMLIST_HEADCOUNTS = [
  { value: "1-10", min: 1, max: 10 },
  { value: "11-50", min: 11, max: 50 },
  { value: "51-200", min: 51, max: 200 },
  { value: "201-500", min: 201, max: 500 },
  { value: "501-1000", min: 501, max: 1000 },
  { value: "1001-5000", min: 1001, max: 5000 },
  { value: "5001-10000", min: 5001, max: 10000 },
  { value: "10001+", min: 10001, max: Infinity },
];

/** INSEE brackets → every Lemlist bucket they really overlap (10-49 → "11-50"); a shared bound alone does not count. */
export function lemlistHeadcounts(codes: string[]) {
  const ranges = headcountRanges(codes);
  return LEMLIST_HEADCOUNTS.filter((bucket) =>
    ranges.some((range) => bucket.min <= (range.max ?? Infinity) && bucket.max > range.min),
  ).map((bucket) => bucket.value);
}

export function lemlistSearchBody(filters: TargetFilters, page: number) {
  const body: { filters: { filterId: string; in: string[]; out: string[] }[]; page: number; size: number } = {
    filters: [{ filterId: "country", in: ["France"], out: [] }],
    page,
    size: LEMLIST_PAGE_SIZE,
  };
  const add = (filterId: string, values: string[]) => {
    if (values.length) body.filters.push({ filterId, in: [...new Set(values)], out: [] });
  };

  add("currentTitle", filters.jobTitles);
  add("seniority", filters.seniorities.map((s) => LEMLIST_SENIORITY[s as Seniority]).filter(Boolean));
  add("currentCompanyHeadcount", lemlistHeadcounts(filters.headcountCodes));
  add("currentCompanyLocation", placeNames(filters));
  // Full text on the company name and description, values OR'ed. The seller's words match
  // French descriptions; the English industry only when there are none
  add("keywordInCompany", filters.keywords.length ? filters.keywords : searchKeywords(filters).slice(0, 3));
  return body;
}

type LemlistExperience = {
  title?: string | null;
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

// The search also returns a guessed "potential_email": never read, only a verified reveal counts
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
        title: person.title?.trim() || experience?.title?.trim() || null,
        companyName: person.current_exp_company_name?.trim() || experience?.company_name?.trim() || null,
        companyDomain: experience?.company_domain?.toLowerCase().replace(/^www\./, "") || null,
        linkedinUrl: normalizeLinkedinUrl(person.lead_linkedin_url) ? person.lead_linkedin_url! : null,
      },
    ];
  });
}

/** The plan decides the real page size (1 per call on the current account): read it from the answer. */
export function lemlistHasMore(body: { total?: number | null; size?: number | null; results?: unknown[] }, page: number) {
  const size = body.size || body.results?.length || 0;
  if (size === 0) return false;
  return typeof body.total === "number" ? page * size < body.total : size >= LEMLIST_PAGE_SIZE;
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
