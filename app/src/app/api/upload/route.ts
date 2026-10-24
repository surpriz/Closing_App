import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { blobToken, capsuleUploadPrefix, documentUploadPrefix, pitchUploadPrefix } from "@/lib/blob";
import { MAX_UPLOAD_BYTES } from "@/lib/closing/constants";
import { CAPSULE_POSTER_TYPE, CAPSULE_VIDEO_MAX_BYTES, PITCH_VIDEO_MAX_BYTES } from "@/lib/closing/media/limits";
import { ALLOWED_MEDIA_TYPES } from "@/lib/closing/media/mime";
import { consumeLimit } from "@/lib/rate-limit";
import { getWorkspace } from "@/lib/session";

// Issues short-lived tokens so the browser uploads PDFs, page capsules and video pitches straight to Blob
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        const workspace = await getWorkspace();
        if (!workspace) throw new Error("Not authenticated");
        if (!(await consumeLimit("upload", request.headers, workspace.user.id))) throw new Error("Too many uploads");

        const organizationId = workspace.organization.id;
        if (pathname.startsWith(documentUploadPrefix(organizationId))) {
          return {
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            addRandomSuffix: true,
          };
        }
        // Checked again (type, size, duration) when the capsule is saved, the poster too
        if (pathname.startsWith(capsuleUploadPrefix(organizationId))) {
          return {
            allowedContentTypes: [...ALLOWED_MEDIA_TYPES.VIDEO, ...ALLOWED_MEDIA_TYPES.AUDIO, CAPSULE_POSTER_TYPE],
            maximumSizeInBytes: CAPSULE_VIDEO_MAX_BYTES,
            addRandomSuffix: true,
          };
        }
        // Video pitches: the video, the mic track and the still, checked again when the document is created
        if (pathname.startsWith(pitchUploadPrefix(organizationId))) {
          return {
            allowedContentTypes: [...ALLOWED_MEDIA_TYPES.VIDEO, ...ALLOWED_MEDIA_TYPES.AUDIO, CAPSULE_POSTER_TYPE],
            maximumSizeInBytes: PITCH_VIDEO_MAX_BYTES,
            addRandomSuffix: true,
          };
        }
        throw new Error("Invalid upload path");
      },
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
