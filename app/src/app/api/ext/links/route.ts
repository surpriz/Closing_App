import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getTranslator } from "@/i18n/messages";
import { getPublicAppUrl } from "@/lib/app-origin";
import { PlanLimitError } from "@/lib/billing/workspace-plan";
import { createDocumentLink } from "@/lib/closing/documents/create-link";
import { prospectFromRecipient } from "@/lib/closing/prospects/from-recipient";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { settingsSummary } from "@/lib/closing/share/summary";
import { extError, extPlanLimit, withExtensionAuth } from "@/lib/extension-auth";

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
    draft: true,
    source: source === "gmail" ? "extension_gmail" : source === "outlook" ? "extension_outlook" : "outlook_addin",
  }).catch((error) => {
    if (error instanceof PlanLimitError) return error;
    throw error;
  });
  if (link instanceof PlanLimitError) return extPlanLimit(link, user.locale);
  if (!link) return extError(404, "not_found", getTranslator(user.locale)("server.ext.documentNotFound"));

  revalidatePath(`/documents/${documentId}`);
  const [appUrl, settings] = [getPublicAppUrl(), await getWorkspaceSettings(organization.id)];
  return Response.json(
    {
      link: {
        id: link.id,
        name: link.name,
        title: link.title,
        url: `${appUrl}${link.path}`,
        // What the prospect will meet, and where to change it or add a welcome message
        summary: settingsSummary(link, new Date(), user.locale, { autonomy: settings.autonomy }),
        manageUrl: `${appUrl}/links/${link.id}?new=1`,
      },
    },
    { status: 201 },
  );
});
