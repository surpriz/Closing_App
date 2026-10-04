import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

export type LinkSource = "extension_gmail" | "extension_outlook";

// One link = one proposal sent to one prospect company
export async function createDocumentLink(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  name?: string | null;
  prospect?: { email: string; name?: string | null; company?: string | null } | null;
  requireEmail: boolean;
  source?: LinkSource;
}) {
  const document = await prisma.document.findFirst({
    where: {
      id: input.documentId,
      organizationId: input.organizationId,
      archivedAt: null,
      status: { not: "FAILED" },
    },
    select: { id: true },
  });
  if (!document) return null;

  const { prospect } = input;
  return prisma.link.create({
    data: {
      slug: randomSlug(12),
      documentId: document.id,
      organizationId: input.organizationId,
      createdById: input.userId,
      name: input.name || prospect?.company || prospect?.email || null,
      requireEmail: input.requireEmail,
      sentAt: new Date(),
      source: input.source ?? null,
      prospects: prospect
        ? {
            create: {
              email: prospect.email,
              name: prospect.name || null,
              company: prospect.company || null,
            },
          }
        : undefined,
    },
    select: { id: true, slug: true, name: true },
  });
}
