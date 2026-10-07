import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";

import { linkTitle } from "./link-title";

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
    select: { id: true, name: true, docType: true, displayTitle: true },
  });
  if (!document) return null;

  const { prospect } = input;
  const link = await prisma.link.create({
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
  return { ...link, title: linkTitle({ ...document, company: prospect?.company }) };
}
