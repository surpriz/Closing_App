import { MAX_AI_ATTEMPTS } from "@/lib/closing/documents/read-pages";
import { prisma } from "@/lib/db";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

// Polled by the extension while a fresh PDF is being read
export const GET = withExtensionAuth(
  async (_request, { organization }, ctx: RouteContext<"/api/ext/documents/[id]">) => {
    const { id } = await ctx.params;
    const document = await prisma.document.findFirst({
      where: { id, organizationId: organization.id, archivedAt: null },
      select: { id: true, name: true, status: true, docType: true, aiProcessedAt: true, aiAttempts: true },
    });
    if (!document) return extError(404, "not_found");
    const { docType, aiProcessedAt, aiAttempts, ...summary } = document;
    // The AI has classified it (and titled it), or will not: the link can be made
    const titled = docType !== null || aiProcessedAt !== null || summary.status === "FAILED" || aiAttempts >= MAX_AI_ATTEMPTS;
    return Response.json({ document: { ...summary, titled } });
  },
);
