import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

import type { AiProvider } from "../types";

export type AiPurpose = "followup" | "chat" | "classify" | "analyze";
/** Purposes recorded in ai_usage: the language model ones, plus speech to text. */
export type AiUsagePurpose = AiPurpose | "transcribe";

const DEFAULT_MODELS: Record<AiProvider, Record<AiPurpose, string>> = {
  openai: { followup: "gpt-4o", chat: "gpt-4o-mini", classify: "gpt-4o-mini", analyze: "gpt-4o" },
  anthropic: {
    followup: "claude-sonnet-5-5",
    chat: "claude-sonnet-5-5",
    classify: "claude-haiku-4-5-20251001",
    analyze: "claude-sonnet-5-5",
  },
};

const MODEL_ENV: Record<AiPurpose, string | undefined> = {
  get followup() {
    return process.env.AI_MODEL_FOLLOWUP;
  },
  get chat() {
    return process.env.AI_MODEL_CHAT;
  },
  get classify() {
    return process.env.AI_MODEL_CLASSIFY;
  },
  get analyze() {
    return process.env.AI_MODEL_ANALYZE;
  },
};

// Null when the selected provider has no API key: callers fall back to templates
export function getLanguageModel(purpose: AiPurpose) {
  const provider: AiProvider = process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai";
  const modelId = MODEL_ENV[purpose] || DEFAULT_MODELS[provider][purpose];

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return { provider, modelId, model: createAnthropic({ apiKey })(modelId) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return { provider, modelId, model: createOpenAI({ apiKey })(modelId) };
}

/** Voice comments are transcribed by OpenAI whatever AI_PROVIDER says: Anthropic has no speech to text. */
export function getTranscriptionModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const modelId = process.env.AI_MODEL_TRANSCRIBE || "gpt-4o-mini-transcribe";
  return { provider: "openai" as const, modelId, model: createOpenAI({ apiKey }).transcription(modelId) };
}
