import { documentSummary, documentSummarySelect } from "@/lib/closing/documents/create-document";
import { prisma } from "@/lib/db";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

export const GET = withExtensionAuth(
  async (_request, { organization }, ctx: RouteContext<"/api/ext/documents/[id]">) => {
    const { id } = await ctx.params;
    const document = await prisma.document.findFirst({
      where: { id, organizationId: organization.id, archivedAt: null },
      select: documentSummarySelect,
    });
    if (!document) return extError(404, "not_found");
    return Response.json({ document: documentSummary(document) });
  },
);
