export type AiProviderName = "openai" | "anthropic";

/**
 * Reads AI_PROVIDER forgivingly. Pure. Spaces, case and "claude" are accepted; an unknown
 * or empty value picks the provider whose key is set (Anthropic when it is the only one),
 * so a typo in the dashboard never takes the whole app down.
 */
export function resolveAiProvider(env: Record<string, string | undefined>): AiProviderName {
  const value = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (value === "anthropic" || value === "claude") return "anthropic";
  if (value === "openai") return "openai";
  return env.ANTHROPIC_API_KEY?.trim() && !env.OPENAI_API_KEY?.trim() ? "anthropic" : "openai";
}
