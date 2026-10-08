import { revalidatePath } from "next/cache";
import { z } from "zod";

import { confirmLinkSent } from "@/lib/closing/documents/create-link";
import { prospectFromRecipient } from "@/lib/closing/prospects/from-recipient";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

const schema = z.object({
  recipient: z
    .object({ email: z.string().max(254), displayName: z.string().max(200).nullish() })
    .nullish(),
});

// The seller pressed Send in Gmail or Outlook: the draft link becomes a deal
export const POST = withExtensionAuth(
  async (request, { organization }, ctx: RouteContext<"/api/ext/links/[id]/sent">) => {
    const { id } = await ctx.params;
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return extError(400, "invalid");

    const { recipient } = parsed.data;
    const link = await confirmLinkSent({
      organizationId: organization.id,
      linkId: id,
      prospect: recipient ? prospectFromRecipient(recipient) : null,
    });
    if (!link) return extError(404, "not_found");

    revalidatePath("/dashboard");
    return Response.json({ link: { id: link.id, name: link.name, sent: link.draftAt === null } });
  },
);
