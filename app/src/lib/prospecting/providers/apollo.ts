import type { TargetFilters } from "../target";
import {
  apolloCandidates,
  apolloHasMore,
  apolloRevealBody,
  apolloRevealOutcomes,
  apolloSearchParams,
} from "./apollo-map";
import { ProviderError, type ProspectingProvider, type RevealInput, type RevealOutcome } from "./types";

const BASE_URL = "https://api.apollo.io/api/v1";
const BULK_MAX = 10;

async function call(apiKey: string, path: string, init: { query?: URLSearchParams; body?: unknown }) {
  const url = `${BASE_URL}${path}${init.query ? `?${init.query}` : ""}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-cache", "x-api-key": apiKey },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new ProviderError("APOLLO", response.status, `Apollo ${path} answered ${response.status} ${detail}`);
  }
  return response.json();
}

export function apolloProvider(apiKey: string): ProspectingProvider {
  return {
    name: "APOLLO",

    async searchPeople(filters: TargetFilters, page: number) {
      const body = await call(apiKey, "/mixed_people/api_search", { query: apolloSearchParams(filters, page) });
      return { candidates: apolloCandidates(body), hasMore: apolloHasMore(body, page), credits: 0, estimated: true };
    },

    async startReveal(inputs: RevealInput[]) {
      const outcomes: RevealOutcome[] = [];
      for (let i = 0; i < inputs.length; i += BULK_MAX) {
        const batch = inputs.slice(i, i + BULK_MAX);
        const body = await call(apiKey, "/people/bulk_match", { body: apolloRevealBody(batch) });
        outcomes.push(...apolloRevealOutcomes(batch, body));
      }
      return outcomes;
    },

    // Apollo answers right away: nothing is ever pending
    async pollReveal(jobId: string, input: RevealInput): Promise<RevealOutcome> {
      return { state: "pending", externalId: input.externalId, jobId };
    },
  };
}
