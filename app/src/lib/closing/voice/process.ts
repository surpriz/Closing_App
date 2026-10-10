import { transcribe } from "ai";

import { readPrivateBlob } from "@/lib/blob";
import { prisma } from "@/lib/db";

import { getTranscriptionModel } from "../ai/provider";
import { estimateTranscriptionCostMicroUsd, recordAiUsage } from "../ai/usage";
import { HOUR_MS } from "../constants";
import { VOICE_ALERTS_PER_LINK_HOUR } from "../media/limits";
import { notifySeller } from "../notify/notify";

const TRANSCRIPT_IN_ALERT_MAX = 500;

/**
 * After a prospect sent a voice comment: transcribe it, then tell the seller.
 * The alert leaves even when the transcription fails, the seller can listen.
 */
export async function processVoiceComment(commentId: string, now = new Date()) {
  const comment = await prisma.voiceComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      linkId: true,
      blobPathname: true,
      pageNumber: true,
      link: { select: { organizationId: true } },
      view: { select: { id: true, fromSeller: true, email: true } },
      prospect: { select: { name: true, email: true } },
    },
  });
  if (!comment) return;

  const transcript = await transcribeComment(comment);

  // The seller testing their own link, or a prospect sending many in a row: the deal page is enough
  if (comment.view.fromSeller) return;
  const recent = await prisma.sellerAlert.count({
    where: { linkId: comment.linkId, type: "VOICE_COMMENT", createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
  });
  if (recent >= VOICE_ALERTS_PER_LINK_HOUR) return;

  await notifySeller({
    linkId: comment.linkId,
    type: "VOICE_COMMENT",
    dedupeKey: `voice:${comment.id}`,
    payload: {
      pageNumber: comment.pageNumber,
      transcript: transcript ? truncate(transcript, TRANSCRIPT_IN_ALERT_MAX) : null,
      prospectName: comment.prospect?.name ?? null,
      prospectEmail: comment.prospect?.email ?? comment.view.email ?? null,
      viewId: comment.view.id,
    },
    now,
  });
}

async function transcribeComment(comment: {
  id: string;
  linkId: string;
  blobPathname: string;
  link: { organizationId: string };
}) {
  const llm = getTranscriptionModel();
  let result: { text: string; language: string | null; seconds: number | null } | null = null;
  const startedAt = Date.now();
  if (llm) {
    try {
      const audio = await readPrivateBlob(comment.blobPathname);
      const output = await transcribe({ model: llm.model, audio, abortSignal: AbortSignal.timeout(40_000) });
      result = { text: output.text.trim(), language: output.language ?? null, seconds: output.durationInSeconds ?? null };
    } catch (error) {
      console.error("[voice] transcription failed", error);
    }
  }

  const text = result?.text || null;
  await prisma.voiceComment.update({
    where: { id: comment.id },
    data: {
      status: text ? "TRANSCRIBED" : "FAILED",
      transcript: text,
      language: result?.language ?? null,
      ...(result?.seconds ? { durationMs: Math.round(result.seconds * 1000) } : {}),
    },
  });
  if (llm) {
    await recordAiUsage({
      organizationId: comment.link.organizationId,
      linkId: comment.linkId,
      purpose: "transcribe",
      provider: llm.provider,
      modelId: llm.modelId,
      latencyMs: Date.now() - startedAt,
      ok: result !== null,
      costMicroUsd: result ? estimateTranscriptionCostMicroUsd(llm.modelId, result.seconds ?? 60) : 0,
    });
  }
  return text;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
