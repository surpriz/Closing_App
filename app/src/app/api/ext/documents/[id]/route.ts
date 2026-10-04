import { prisma } from "@/lib/db";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

// Polled by the extension while a fresh PDF is being read
export const GET = withExtensionAuth(
  async (_request, { organization }, ctx: RouteContext<"/api/ext/documents/[id]">) => {
    const { id } = await ctx.params;
    const document = await prisma.document.findFirst({
      where: { id, organizationId: organization.id, archivedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!document) return extError(404, "not_found");
    return Response.json({ document });
  },
);
