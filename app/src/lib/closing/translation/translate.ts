import { generateText, type LanguageModelUsage } from "ai";

import { prisma } from "@/lib/db";

import { getLanguageModel, THINKING_ROOM_TOKENS } from "../ai/provider";
import { recordAiUsage } from "../ai/usage";
import type { SupportedLocale } from "../constants";
import { cleanArticleHtml } from "../documents/reader-view";
import {
  ARTICLE_PART,
  splitHtmlBlocks,
  stripCodeFence,
  translationOutputTokens,
  translationSystemPrompt,
} from "./translation";

const CALL_TIMEOUT_MS = 60_000;
const PARALLEL_CALLS = 4;

type Llm = NonNullable<ReturnType<typeof getLanguageModel>>;
type Scope = { documentId: string; organizationId: string; linkId: string };

async function translateHtml(llm: Llm, scope: Scope, text: string, locale: SupportedLocale) {
  const startedAt = Date.now();
  const record = (ok: boolean, usage?: LanguageModelUsage) =>
    recordAiUsage({
      organizationId: scope.organizationId,
      linkId: scope.linkId,
      purpose: "translate",
      provider: llm.provider,
      modelId: llm.modelId,
      usage,
      latencyMs: Date.now() - startedAt,
      ok,
    });

  let result;
  try {
    result = await generateText({
      model: llm.model,
      system: translationSystemPrompt(locale),
      prompt: `<document>\n${text}\n</document>`,
      maxOutputTokens: THINKING_ROOM_TOKENS + translationOutputTokens(text.length),
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch (error) {
    await record(false);
    throw error;
  }
  const translated = stripCodeFence(result.text);
  // A cut or empty answer would be kept and served to every next reader: fail, the next visit tries again
  const ok = result.finishReason !== "length" && translated.length > 0;
  await record(ok, result.usage);
  if (!ok) throw new Error(`translation unusable (${result.finishReason}, ${translated.length} chars)`);
  return translated;
}

async function store(llm: Llm, documentId: string, locale: SupportedLocale, part: number, content: string) {
  // Two readers asking at once both pay, the first answer stays. Callers look in the cache first (cachedTranslation)
  await prisma.documentTranslation.createMany({
    data: { documentId, locale, part, content, model: llm.modelId },
    skipDuplicates: true,
  });
}

/** Cached translations, without calling the model: what a reader gets for free. */
export async function cachedTranslation(documentId: string, locale: SupportedLocale, part: number) {
  const row = await prisma.documentTranslation.findUnique({
    where: { documentId_locale_part: { documentId, locale, part } },
    select: { content: true },
  });
  return row?.content ?? null;
}

/**
 * The reader view of a web page in the reader's language. Cut between blocks
 * so each call stays short, then cleaned again: the model's HTML is never trusted.
 */
export async function translateArticle(
  llm: Llm,
  scope: Scope,
  locale: SupportedLocale,
  article: { readerHtml: string; externalUrl: string },
) {
  const chunks = splitHtmlBlocks(article.readerHtml);
  const translated: string[] = [];
  for (let i = 0; i < chunks.length; i += PARALLEL_CALLS) {
    translated.push(
      ...(await Promise.all(
        chunks.slice(i, i + PARALLEL_CALLS).map((chunk) => translateHtml(llm, scope, chunk, locale)),
      )),
    );
  }
  const content = cleanArticleHtml(translated.join(""), new URL(article.externalUrl));
  await store(llm, scope.documentId, locale, ARTICLE_PART, content);
  return content;
}
