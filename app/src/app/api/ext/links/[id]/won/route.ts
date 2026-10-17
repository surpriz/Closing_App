import { revalidatePath } from "next/cache";

import { getTranslator } from "@/i18n/messages";
import { applyDealStatus } from "@/lib/closing/deals/status";
import { prisma } from "@/lib/db";
import { extError, withExtensionAuth } from "@/lib/extension-auth";
import { isManagerRole } from "@/lib/roles";

// "Marquer gagné" on the extension's "Marie a validé" alert: the seller's own deal, or any for a manager
export const POST = withExtensionAuth(
  async (_request, { user, organization }, ctx: RouteContext<"/api/ext/links/[id]/won">) => {
    const { id } = await ctx.params;
    const [link, member] = await Promise.all([
      prisma.link.findFirst({
        where: { id, organizationId: organization.id, archivedAt: null },
        select: { id: true, documentId: true, createdById: true, dealStatus: true },
      }),
      prisma.member.findFirst({ where: { userId: user.id, organizationId: organization.id }, select: { role: true } }),
    ]);
    if (!link) return extError(404, "not_found");
    if (link.createdById !== user.id && !isManagerRole(member?.role ?? "")) return extError(403, "forbidden");

    // Only what the alert offers: a deal the prospect signed, not closed yet
    if (link.dealStatus !== "VALIDATED") return extError(409, "not_validated", getTranslator(user.locale)("server.ext.dealNotPending"));
    await applyDealStatus(link.id, "WON");
    revalidatePath(`/links/${link.id}`);
    revalidatePath("/dashboard");
    return Response.json({ link: { id: link.id, dealStatus: "WON" } });
  },
);
