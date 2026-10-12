import { resolveProviderCredentials } from "../credentials";
import { apolloProvider } from "./apollo";
import { lemlistProvider } from "./lemlist";
import { mockProvider } from "./mock";
import type { ProspectingProvider, ProviderName } from "./types";

/** Built per call, never at import: no key, no client. */
export function getProvider(organizationId: string, name: ProviderName): ProspectingProvider | null {
  const credentials = resolveProviderCredentials(organizationId, name);
  if (!credentials) return null;
  if (name === "APOLLO") return apolloProvider(credentials.apiKey);
  if (name === "LEMLIST") return lemlistProvider(credentials.apiKey);
  return mockProvider();
}
