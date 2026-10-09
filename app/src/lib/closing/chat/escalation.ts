import { createHash } from "node:crypto";

import { z } from "zod";

/** Pure helpers for forwarding a prospect question to the seller. */

function normalize(question: string) {
  return question
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The same question asked twice in a session makes one alert. */
export function escalationDedupeKey(viewId: string, question: string) {
  const hash = createHash("sha256").update(normalize(question)).digest("hex").slice(0, 12);
  return `chat_question:${viewId}:${hash}`;
}

/**
 * An email the model says the reader gave. Kept only when the reader really
 * typed it: a made-up address would send the seller's answer to a stranger.
 */
export function contactEmailFromConversation(candidate: string | undefined, userTexts: string[]) {
  const email = candidate?.trim().toLowerCase();
  if (!email || !z.email().safeParse(email).success) return null;
  return userTexts.some((text) => text.toLowerCase().includes(email)) ? email : null;
}

// The answer promises the seller will reply, in the four viewer languages
const PROMISED_REPLY = [
  /reviendr[ae]s? vers vous/i,
  /vous recontacter/i,
  /transmis (votre|la) question/i,
  /get back to you/i,
  /passed (your|the|this) question/i,
  /se pondr[aá] en contacto/i,
  /le responder[aá]/i,
  /meldet sich/i,
  /weitergeleitet/i,
];

/** The model told the reader the seller would answer but forgot to call the tool. */
export function promisesSellerReply(answer: string) {
  return PROMISED_REPLY.some((pattern) => pattern.test(answer));
}
