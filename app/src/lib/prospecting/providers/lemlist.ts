import { ProviderError, type ProspectingProvider } from "./types";

// Filled in at step 6, once the filter ids are read from GET /api/database/filters
export function lemlistProvider(_apiKey: string): ProspectingProvider {
  const unavailable = async (): Promise<never> => {
    throw new ProviderError("LEMLIST", 501, "Lemlist is not wired yet");
  };
  return { name: "LEMLIST", searchPeople: unavailable, startReveal: unavailable, pollReveal: unavailable };
}
