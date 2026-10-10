import type { NextRequest } from "next/server";
import { z } from "zod";

import { putPrivateBlob, voiceCommentPrefix } from "@/lib/blob";
import { inBackground } from "@/lib/closing/background";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";
import { VOICE_COMMENT_MAX_BYTES } from "@/lib/closing/media/limits";
import { baseMime, extensionFor, matchesContainer } from "@/lib/closing/media/mime";
import { validateMedia } from "@/lib/closing/media/validate";
import { isCrawlerView, resolveViewerView } from "@/lib/closing/tracking/viewer-view";
import { processVoiceComment } from "@/lib/closing/voice/process";
import { countRecentVoiceComments } from "@/lib/closing/voice/queries";
import { decideVoiceQuota } from "@/lib/closing/voice/quota";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

const fieldsSchema = z.object({
  pageNumber: z.coerce.number().int().min(1),
  durationMs: z.coerce.number().int().min(1),
  viewId: z.string().max(64).nullish(),
});

/**
 * The prospect leaves a voice comment on a page. The audio is small (60 s of
 * Opus is ~0.5 MB) so it comes in the request itself; it is transcribed and
 * passed on to the seller after the response.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v/[slug]/voice">) {
  const { slug } = await ctx.params;
  // Multipart overhead on top of the audio
  if (Number(request.headers.get("content-length") ?? 0) > VOICE_COMMENT_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const link = await getLinkForViewer(slug);
  if (!link || link.document.status !== "READY" || link.document.kind !== "FILE" || !link.voiceCommentsEnabled) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const access = await getViewerAccess(link);
  if (!access.allowed) return Response.json({ error: "email_required" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const fields = fieldsSchema.safeParse({
    pageNumber: form?.get("pageNumber"),
    durationMs: form?.get("durationMs"),
    viewId: form?.get("viewId"),
  });
  if (!(audio instanceof File) || !fields.success) return Response.json({ error: "invalid_body" }, { status: 400 });
  const { pageNumber, durationMs, viewId } = fields.data;
  if (pageNumber > (link.document.numPages ?? 0)) return Response.json({ error: "invalid_body" }, { status: 400 });

  const now = new Date();
  const view = await resolveViewerView(link.id, viewId, now);
  if (!view) return Response.json({ error: "no_view" }, { status: 409 });
  if (isCrawlerView(view)) return Response.json({ error: "forbidden" }, { status: 403 });

  const counts = await countRecentVoiceComments({ linkId: link.id, view, now });
  const quotaError = decideVoiceQuota(counts);
  if (quotaError) return Response.json({ error: quotaError }, { status: 429 });

  // Trust the bytes, not the declared type
  const contentType = baseMime(audio.type);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const mediaError = validateMedia({ use: "voice_comment", kind: "AUDIO", contentType, size: bytes.length, durationMs });
  if (mediaError || !matchesContainer(contentType, bytes)) {
    return Response.json({ error: mediaError ?? "type" }, { status: 400 });
  }

  const blob = await putPrivateBlob(
    `${voiceCommentPrefix(link.organizationId, link.id)}p${pageNumber}.${extensionFor(contentType)}`,
    bytes,
    contentType,
  );
  const prospect = access.email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email: access.email } },
        select: { id: true },
      })
    : null;
  const comment = await prisma.voiceComment.create({
    data: {
      linkId: link.id,
      viewId: view.id,
      prospectId: prospect?.id ?? null,
      pageNumber,
      blobPathname: blob.pathname,
      contentType,
      sizeBytes: bytes.length,
      durationMs,
    },
    select: { id: true },
  });

  inBackground("voice-comment", () => processVoiceComment(comment.id));
  return Response.json({ id: comment.id }, { status: 201 });
}
