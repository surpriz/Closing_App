import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { blobToken, capsuleUploadPrefix, documentUploadPrefix } from "@/lib/blob";
import { MAX_UPLOAD_BYTES } from "@/lib/closing/constants";
import { CAPSULE_VIDEO_MAX_BYTES } from "@/lib/closing/media/limits";
import { ALLOWED_MEDIA_TYPES } from "@/lib/closing/media/mime";
import { getWorkspace } from "@/lib/session";

// Issues short-lived tokens so the browser uploads PDFs and page capsules straight to Blob
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

        const organizationId = workspace.organization.id;
        if (pathname.startsWith(documentUploadPrefix(organizationId))) {
          return {
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            addRandomSuffix: true,
          };
        }
        // Checked again (type, size, duration) when the capsule is saved
        if (pathname.startsWith(capsuleUploadPrefix(organizationId))) {
          return {
            allowedContentTypes: [...ALLOWED_MEDIA_TYPES.VIDEO, ...ALLOWED_MEDIA_TYPES.AUDIO],
            maximumSizeInBytes: CAPSULE_VIDEO_MAX_BYTES,
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
