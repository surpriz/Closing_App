import type { TargetFilters } from "../target";

export type ProviderName = "APOLLO" | "LEMLIST" | "MOCK";

/** A person as the provider shows it before any reveal: no email. */
export type Candidate = {
  externalId: string;
  firstName: string | null;
  /** Masked by Apollo ("Hu***n"), full with Lemlist: never shown as is before the reveal. */
  lastName: string | null;
  lastNameIsMasked: boolean;
  title: string | null;
  companyName: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
};

export type SearchPage = {
  candidates: Candidate[];
  hasMore: boolean;
  /** Provider credits spent on this page. */
  credits: number;
  estimated: boolean;
};

export type RevealInput = {
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
};

export type RevealDone = {
  state: "done";
  externalId: string;
  email: string | null;
  emailStatus: string | null;
  /** The provider vouches for the address (verified, deliverable). */
  verified: boolean;
  lastName: string | null;
  linkedinUrl: string | null;
  companyDomain: string | null;
  credits: number;
  estimated: boolean;
};

export type RevealPending = { state: "pending"; externalId: string; jobId: string };

/** The provider call failed for this person: nothing was charged, the reveal is retried. */
export type RevealFailed = { state: "error"; externalId: string; message: string };

export type RevealOutcome = RevealDone | RevealPending | RevealFailed;

export interface ProspectingProvider {
  name: ProviderName;
  searchPeople(filters: TargetFilters, page: number): Promise<SearchPage>;
  /**
   * Sync providers answer "done", async ones "pending" with a job to poll. Never throws:
   * a failed batch comes back as "error" so the outcomes already paid for are kept.
   */
  startReveal(inputs: RevealInput[]): Promise<RevealOutcome[]>;
  pollReveal(jobId: string, input: RevealInput): Promise<RevealOutcome>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
