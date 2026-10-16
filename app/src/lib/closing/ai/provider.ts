import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

import type { AiProvider } from "../types";
import { resolveAiProvider } from "./provider-choice";

/** `help` answers the users themselves about Clozer; `chat` answers prospects. */
export type AiPurpose = "followup" | "chat" | "classify" | "analyze" | "help";
/** Purposes recorded in ai_usage: the language model ones, plus speech to text. */
export type AiUsagePurpose = AiPurpose | "transcribe";

const DEFAULT_MODELS: Record<AiProvider, Record<AiPurpose, string>> = {
  openai: { followup: "gpt-4o", chat: "gpt-4o-mini", classify: "gpt-4o-mini", analyze: "gpt-4o", help: "gpt-4o-mini" },
  anthropic: {
    followup: "claude-sonnet-5-5",
    chat: "claude-sonnet-5-5",
    classify: "claude-haiku-5-5",
    analyze: "claude-sonnet-5-5",
    help: "claude-sonnet-5-5",
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
  get help() {
    return process.env.AI_MODEL_HELP;
  },
};

// Null when the selected provider has no API key: callers fall back to templates
/**
 * Haiku 5.5 and Sonnet 5.5 think before answering, on by default, and the
 * thinking counts against maxOutputTokens: short answers still need this room
 * or the structured output gets cut off.
 */
export const THINKING_ROOM_TOKENS = 4000;

export function getLanguageModel(purpose: AiPurpose) {
  const provider: AiProvider = resolveAiProvider(process.env);
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

/**
 * Voice comments and video pitches are transcribed by OpenAI whatever
 * AI_PROVIDER says: Anthropic has no speech to text. `timestamps` asks for a
 * model that says when each sentence was spoken (whisper-1): the gpt-4o ones
 * return the text alone.
 */
export function getTranscriptionModel({ timestamps = false } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const modelId = timestamps
    ? process.env.AI_MODEL_TRANSCRIBE_TIMED || "whisper-1"
    : process.env.AI_MODEL_TRANSCRIBE || "gpt-4o-mini-transcribe";
  return { provider: "openai" as const, modelId, model: createOpenAI({ apiKey }).transcription(modelId) };
}
