import { transcribe } from "ai";

import { readPrivateBlob } from "@/lib/blob";
import { prisma } from "@/lib/db";

import { getTranscriptionModel } from "../ai/provider";
import { estimateTranscriptionCostMicroUsd, recordAiUsage } from "../ai/usage";
import { detectPageTags } from "./page-tags";
import { splitTranscript } from "./video-segments";

const TRANSCRIBE_TIMEOUT_MS = 90_000;
/** Same cap as a PDF page's text. */
const MAX_SEGMENT_TEXT_CHARS = 20_000;

/**
 * Transcribes the mic track of a video pitch and writes each tenth of what
 * was said into its page, so the AI reading, the chat and the deal analysis
 * work on it as on a PDF. True when some text was written.
 */
export async function transcribeVideoPitch(document: {
  id: string;
  organizationId: string;
  audioPathname: string | null;
  durationMs: number | null;
}) {
  const llm = getTranscriptionModel({ timestamps: true });
  if (!llm || !document.audioPathname) return false;

  const startedAt = Date.now();
  let output: Awaited<ReturnType<typeof transcribe>> | null = null;
  try {
    const audio = await readPrivateBlob(document.audioPathname);
    output = await transcribe({ model: llm.model, audio, abortSignal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS) });
  } catch (error) {
    console.error(`[documents] video transcription failed for ${document.id}`, error);
  }
  const seconds = output?.durationInSeconds ?? (document.durationMs ?? 0) / 1000;
  await recordAiUsage({
    organizationId: document.organizationId,
    purpose: "transcribe",
    provider: llm.provider,
    modelId: llm.modelId,
    latencyMs: Date.now() - startedAt,
    ok: output !== null,
    costMicroUsd: output ? estimateTranscriptionCostMicroUsd(llm.modelId, seconds) : 0,
  });
  if (!output) return false;

  const parts = splitTranscript({
    text: output.text,
    segments: output.segments,
    durationMs: document.durationMs ?? seconds * 1000,
  });
  if (parts.every((part) => part === null)) return false;

  await prisma.$transaction(
    parts.map((part, index) => {
      // Postgres text columns reject NUL bytes
      const text = part?.replace(/\u0000/g, "").slice(0, MAX_SEGMENT_TEXT_CHARS) || null;
      return prisma.documentPage.updateMany({
        where: { documentId: document.id, pageNumber: index + 1 },
        data: { text, tags: detectPageTags(text ?? "") },
      });
    }),
  );
  return true;
}
