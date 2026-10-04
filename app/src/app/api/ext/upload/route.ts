import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { blobToken, documentUploadPrefix } from "@/lib/blob";
import { MAX_UPLOAD_BYTES } from "@/lib/closing/constants";
import { authenticateExtension } from "@/lib/extension-auth";

// Same as /api/upload, authenticated by the extension token instead of the session cookie
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  try {
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        const caller = await authenticateExtension(request);
        if (!caller) throw new Error("Not authenticated");

        if (!pathname.startsWith(documentUploadPrefix(caller.organization.id))) {
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
