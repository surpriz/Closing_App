import { generateText, Output } from "ai";
import { z } from "zod";

import { prisma } from "@/lib/db";

import { getLanguageModel } from "../ai/provider";
import { recordAiUsage } from "../ai/usage";
import { DOC_TYPES } from "./doc-types";
import { inferOfferFromDocument } from "./infer-offer";
import {
  buildPageReadingPrompt,
  chunkPages,
  cleanPageReadings,
  DOC_CLASSIFY_SYSTEM_PROMPT,
  mergePageTags,
  PAGE_TAGS,
  pageReadingSystemPrompt,
  type PageReading,
} from "./page-reading";

/** After this many failed runs the engine stops retrying a document. */
export const MAX_AI_ATTEMPTS = 3;
const PARALLEL_CALLS = 3;
const CALL_TIMEOUT_MS = 45_000;

const readingSchema = z.object({
  pages: z.array(
    z.object({
      pageNumber: z.number().int(),
      summary: z.string().nullable(),
      tags: z.array(z.enum(PAGE_TAGS)),
      keyFacts: z.array(z.string()),
    }),
  ),
});

const classifySchema = z.object({ docType: z.enum(DOC_TYPES), purpose: z.string() });
/** Enough of the start of a document to tell a quote from a résumé. */
const CLASSIFY_CHARS = 4000;

type Llm = NonNullable<ReturnType<typeof getLanguageModel>>;

/** Quote, résumé, deck…: decides what the page tags mean and how deals are read. Null on failure. */
async function classifyDocument(llm: Llm, document: { name: string; organizationId: string }, text: string) {
  const startedAt = Date.now();
  try {
    const { output, usage } = await generateText({
      model: llm.model,
      system: DOC_CLASSIFY_SYSTEM_PROMPT,
      prompt: `Document title: ${document.name}\n<document>\n${text.slice(0, CLASSIFY_CHARS)}\n</document>`,
      output: Output.object({ schema: classifySchema }),
      maxOutputTokens: 200,
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    await recordAiUsage({
      organizationId: document.organizationId,
      purpose: "classify",
      provider: llm.provider,
      modelId: llm.modelId,
      usage,
      latencyMs: Date.now() - startedAt,
      ok: true,
    });
    return { docType: output.docType, purpose: output.purpose.trim().slice(0, 200) || null };
  } catch (error) {
    console.error("[documents] classification failed", error);
    return null;
  }
}

export type ReadPagesOutcome = "done" | "partial" | "failed" | "no_ai" | "skipped";

/**
 * Summarizes every page of a PDF, refines its tags and pulls key facts
 * (amounts, durations). Never fails the document: without AI, or when a call
 * breaks, the keyword tags from the upload stay.
 */
export async function readDocumentPages(documentId: string): Promise<ReadPagesOutcome> {
  const llm = getLanguageModel("classify");
  if (!llm) return "no_ai";

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      organizationId: true,
      aiAttempts: true,
      pages: {
        select: { id: true, pageNumber: true, text: true, tags: true, tagSource: true },
        orderBy: { pageNumber: "asc" },
      },
    },
  });
  if (!document || document.kind !== "FILE" || document.status !== "READY") return "skipped";
  if (document.aiAttempts >= MAX_AI_ATTEMPTS) return "skipped";

  const withText = document.pages.filter((page) => page.text);
  // Claim this attempt: two page views must not read the same document twice
  const claimed = await prisma.document.updateMany({
    where: { id: document.id, aiAttempts: document.aiAttempts },
    data: { aiAttempts: { increment: 1 } },
  });
  if (claimed.count === 0) return "skipped";
  if (withText.length === 0) {
    await prisma.document.update({ where: { id: document.id }, data: { aiProcessedAt: new Date() } });
    return "done";
  }

  const classified = await classifyDocument(llm, document, withText.map((page) => page.text).join("\n"));
  if (classified) {
    await prisma.document.update({
      where: { id: document.id },
      data: { docType: classified.docType, docPurpose: classified.purpose },
    });
  }
  const systemPrompt = pageReadingSystemPrompt(classified?.docType);

  const chunks = chunkPages(withText);
  const readings: PageReading[] = [];
  let failures = 0;

  for (let i = 0; i < chunks.length; i += PARALLEL_CALLS) {
    const batch = await Promise.allSettled(
      chunks.slice(i, i + PARALLEL_CALLS).map(async (chunk) => {
        const startedAt = Date.now();
        try {
          const { output, usage } = await generateText({
            model: llm.model,
            system: systemPrompt,
            prompt: buildPageReadingPrompt(document.name, chunk),
            output: Output.object({ schema: readingSchema }),
            maxOutputTokens: 300 * chunk.length,
            abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
          });
          await recordAiUsage({
            organizationId: document.organizationId,
            purpose: "classify",
            provider: llm.provider,
            modelId: llm.modelId,
            usage,
            latencyMs: Date.now() - startedAt,
            ok: true,
          });
          return cleanPageReadings(
            output.pages,
            chunk.map((page) => page.pageNumber),
          );
        } catch (error) {
          await recordAiUsage({
            organizationId: document.organizationId,
            purpose: "classify",
            provider: llm.provider,
            modelId: llm.modelId,
            latencyMs: Date.now() - startedAt,
            ok: false,
          });
          throw error;
        }
      }),
    );
    for (const result of batch) {
      if (result.status === "fulfilled") readings.push(...result.value);
      else {
        failures++;
        console.error(`[documents] page reading failed for ${document.id}`, result.reason);
      }
    }
  }

  const byPage = new Map(readings.map((reading) => [reading.pageNumber, reading]));
  await prisma.$transaction(
    document.pages
      .filter((page) => byPage.has(page.pageNumber))
      .map((page) => {
        const reading = byPage.get(page.pageNumber)!;
        return prisma.documentPage.update({
          where: { id: page.id },
          data: { summary: reading.summary, keyFacts: reading.keyFacts, tags: mergePageTags(page, reading) },
        });
      }),
  );

  if (failures === 0) {
    await prisma.document.update({ where: { id: document.id }, data: { aiProcessedAt: new Date() } });
    // First document of a seller who skipped "Votre offre": guess it from here
    await inferOfferFromDocument(document.id);
    return "done";
  }
  return readings.length > 0 ? "partial" : "failed";
}

/** Leaves the upload's own run alone: it touches updatedAt when it starts. */
const RETRY_AFTER_MS = 10 * 60 * 1000;

/** Catches up documents uploaded before the AI was configured, or whose reading failed. */
export async function readPendingDocuments(
  now = new Date(),
  limit = 2,
  scope: { organizationId?: string; documentId?: string } = {},
) {
  if (!getLanguageModel("classify")) return 0;
  const pending = await prisma.document.findMany({
    where: {
      kind: "FILE",
      status: "READY",
      archivedAt: null,
      aiProcessedAt: null,
      aiAttempts: { lt: MAX_AI_ATTEMPTS },
      updatedAt: { lte: new Date(now.getTime() - RETRY_AFTER_MS) },
      ...(scope.organizationId && { organizationId: scope.organizationId }),
      ...(scope.documentId && { id: scope.documentId }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });
  const outcomes = await Promise.all(pending.map((document) => readDocumentPages(document.id)));
  return outcomes.filter((outcome) => outcome === "done").length;
}
