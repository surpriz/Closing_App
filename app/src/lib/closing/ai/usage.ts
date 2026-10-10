import type { LanguageModelUsage } from "ai";

import { prisma } from "@/lib/db";

import type { AiUsagePurpose } from "./provider";

/**
 * One row per LLM call in `ai_usage`: cost per workspace, quotas later.
 * Prices in USD per million tokens; unknown models are logged at zero cost.
 */

type Price = { input: number; output: number; cacheRead: number };

const PRICES: { match: RegExp; price: Price }[] = [
  { match: /^claude-sonnet-5/, price: { input: 2, output: 10, cacheRead: 0.2 } },
  { match: /^claude-haiku-4-5/, price: { input: 1, output: 5, cacheRead: 0.1 } },
  { match: /^claude-opus-5-5/, price: { input: 4, output: 20, cacheRead: 0.2 } },
  { match: /^gpt-4o-mini/, price: { input: 0.15, output: 0.6, cacheRead: 0.075 } },
  { match: /^gpt-4o/, price: { input: 2.5, output: 10, cacheRead: 1.25 } },
];

export function estimateCostMicroUsd(modelId: string, usage: LanguageModelUsage | undefined) {
  const price = PRICES.find((p) => p.match.test(modelId))?.price;
  if (!price || !usage) return 0;
  const cached = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const fresh = Math.max(0, (usage.inputTokens ?? 0) - cached);
  // $ per MTok = µ$ per token
  return Math.round(fresh * price.input + cached * price.cacheRead + (usage.outputTokens ?? 0) * price.output);
}

/** Speech to text is billed by the minute, in USD. */
const TRANSCRIPTION_PRICES: { match: RegExp; perMinute: number }[] = [
  { match: /^gpt-4o-mini-transcribe/, perMinute: 0.003 },
  { match: /^gpt-4o-transcribe/, perMinute: 0.006 },
  { match: /^whisper-1/, perMinute: 0.006 },
];

export function estimateTranscriptionCostMicroUsd(modelId: string, seconds: number) {
  const perMinute = TRANSCRIPTION_PRICES.find((p) => p.match.test(modelId))?.perMinute ?? 0;
  return Math.round((Math.max(0, seconds) / 60) * perMinute * 1_000_000);
}

export async function recordAiUsage(input: {
  organizationId: string;
  linkId?: string | null;
  purpose: AiUsagePurpose;
  provider: string;
  modelId: string;
  usage?: LanguageModelUsage;
  latencyMs: number;
  ok: boolean;
  /** For calls not billed by the token (transcription). */
  costMicroUsd?: number;
}) {
  try {
    await prisma.aiUsage.create({
      data: {
        organizationId: input.organizationId,
        linkId: input.linkId ?? null,
        purpose: input.purpose,
        provider: input.provider,
        model: input.modelId,
        tokensIn: input.usage?.inputTokens ?? 0,
        tokensOut: input.usage?.outputTokens ?? 0,
        cachedTokens: input.usage?.inputTokenDetails?.cacheReadTokens ?? 0,
        costMicroUsd: input.costMicroUsd ?? estimateCostMicroUsd(input.modelId, input.usage),
        latencyMs: input.latencyMs,
        ok: input.ok,
      },
    });
  } catch (error) {
    // Bookkeeping must never break the feature it measures
    console.error("[ai] usage not recorded", error);
  }
}
