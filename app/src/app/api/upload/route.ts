import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { blobToken, documentUploadPrefix } from "@/lib/blob";
import { MAX_UPLOAD_BYTES } from "@/lib/closing/constants";
import { getWorkspace } from "@/lib/session";

// Issues short-lived tokens so the browser uploads PDFs straight to Blob
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

        if (!pathname.startsWith(documentUploadPrefix(workspace.organization.id))) {
          throw new Error("Invalid upload path");
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
