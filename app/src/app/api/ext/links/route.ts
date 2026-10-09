import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPublicAppUrl } from "@/lib/app-origin";
import { createDocumentLink } from "@/lib/closing/documents/create-link";
import { prospectFromRecipient } from "@/lib/closing/prospects/from-recipient";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

const schema = z.object({
  documentId: z.string().min(1).max(64),
  recipient: z
    .object({ email: z.string().max(254), displayName: z.string().max(200).nullish() })
    .nullish(),
  // outlook_addin: the Office add-in (Outlook for Windows / Mac)
  source: z.enum(["gmail", "outlook", "outlook_addin"]),
});

// One link per email: the first "To" recipient becomes the prospect
export const POST = withExtensionAuth(async (request, { user, organization }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extError(400, "invalid");
  const { documentId, recipient, source } = parsed.data;

  const link = await createDocumentLink({
    organizationId: organization.id,
    userId: user.id,
    documentId,
    prospect: recipient ? prospectFromRecipient(recipient) : null,
    requireEmail: true,
    draft: true,
    source: source === "gmail" ? "extension_gmail" : source === "outlook" ? "extension_outlook" : "outlook_addin",
  });
  if (!link) return extError(404, "not_found", "Document introuvable.");

  revalidatePath(`/documents/${documentId}`);
  return Response.json(
    { link: { id: link.id, name: link.name, title: link.title, url: `${getPublicAppUrl()}/v/${link.slug}` } },
    { status: 201 },
  );
});
