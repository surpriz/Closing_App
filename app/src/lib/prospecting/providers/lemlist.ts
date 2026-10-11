import type { TargetFilters } from "../target";
import {
  lemlistCandidates,
  lemlistEnrichParams,
  lemlistHasMore,
  lemlistRevealOutcome,
  lemlistSearchBody,
} from "./lemlist-map";
import { ProviderError, type ProspectingProvider, type RevealInput, type RevealOutcome } from "./types";

const BASE_URL = "https://api.lemlist.com/api";
// 20 requests per 2 seconds per key: one every 110 ms leaves some room
const SPACING_MS = 110;

let last = 0;
async function spaced() {
  const wait = last + SPACING_MS - Date.now();
  last = Math.max(Date.now(), last + SPACING_MS);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

async function call(apiKey: string, method: "GET" | "POST", path: string, init: { query?: URLSearchParams; body?: unknown } = {}) {
  const url = `${BASE_URL}${path}${init.query ? `?${init.query}` : ""}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    await spaced();
    const response = await fetch(url, {
      method,
      // Basic auth with an empty login and the key as password
      headers: {
        authorization: `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}`,
        ...(init.body !== undefined && { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429 && attempt === 0) {
      const seconds = Math.min(Number(response.headers.get("retry-after")) || 2, 10);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      throw new ProviderError("LEMLIST", response.status, `Lemlist ${path} answered ${response.status} ${detail}`);
    }
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  throw new ProviderError("LEMLIST", 429, "Lemlist rate limit");
}

export function lemlistProvider(apiKey: string): ProspectingProvider {
  return {
    name: "LEMLIST",

    async searchPeople(filters: TargetFilters, page: number) {
      const { body } = await call(apiKey, "POST", "/database/people", { body: lemlistSearchBody(filters, page) });
      return { candidates: lemlistCandidates(body), hasMore: lemlistHasMore(body, page), credits: 0, estimated: true };
    },

    // Asynchronous: each person gets an enrichment id, polled until done
    async startReveal(inputs: RevealInput[]) {
      const outcomes: RevealOutcome[] = [];
      for (const input of inputs) {
        const { body } = await call(apiKey, "POST", "/enrich", { query: lemlistEnrichParams(input) });
        outcomes.push({ state: "pending", externalId: input.externalId, jobId: String(body.id) });
      }
      return outcomes;
    },

    async pollReveal(jobId: string, input: RevealInput): Promise<RevealOutcome> {
      const { status, body } = await call(apiKey, "GET", `/enrich/${encodeURIComponent(jobId)}`);
      if (status === 202 || body?.enrichmentStatus !== "done") {
        return { state: "pending", externalId: input.externalId, jobId };
      }
      return lemlistRevealOutcome(input, body);
    },
  };
}

/** Filter ids accepted by the people database: to fill LEMLIST_FILTERS. */
export async function lemlistFilters(apiKey: string) {
  const { body } = await call(apiKey, "GET", "/database/filters");
  return body;
}
