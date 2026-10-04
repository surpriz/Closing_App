import { findReusableDocument, isSha256 } from "@/lib/closing/documents/create-document";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

// Same PDF already in the workspace? Then the extension skips the upload.
export const POST = withExtensionAuth(async (request, { organization }) => {
  const body = (await request.json().catch(() => null)) as { sha256?: unknown } | null;
  if (!isSha256(body?.sha256)) return extError(400, "invalid");

  const document = await findReusableDocument(organization.id, body.sha256);
  return Response.json({ document });
});
