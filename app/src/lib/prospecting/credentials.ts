import { getEnv } from "@/lib/env";

import type { ProviderName } from "./providers/types";

export type ProviderCredentials = {
  apiKey: string;
  /** "platform" = Clozer's own account. A customer's own key ("workspace") will come later. */
  source: "platform" | "workspace";
};

/**
 * The key used for a workspace. Today always Clozer's key from the server env; the
 * organizationId is there so a workspace can bring its own key without touching callers.
 */
export function resolveProviderCredentials(_organizationId: string, provider: ProviderName): ProviderCredentials | null {
  const env = getEnv();
  if (provider === "MOCK") return env.PROSPECTING_MOCK === "true" && process.env.VERCEL_ENV !== "production"
    ? { apiKey: "mock", source: "platform" }
    : null;
  const apiKey = provider === "APOLLO" ? env.APOLLO_API_KEY : env.LEMLIST_API_KEY;
  return apiKey ? { apiKey, source: "platform" } : null;
}

export function availableProviders(organizationId: string): ProviderName[] {
  return (["APOLLO", "LEMLIST", "MOCK"] as const).filter((p) => resolveProviderCredentials(organizationId, p));
}
