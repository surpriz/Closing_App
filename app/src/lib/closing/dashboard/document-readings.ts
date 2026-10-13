import { prisma } from "@/lib/db";

import { readingsByDocument } from "./document-heat";
import { getPageReadings } from "./queries";

/** Reading time per page of each document, every prospect together, bots aside. */
export async function getDocumentPageReadings(documentIds: string[]) {
  if (documentIds.length === 0) return new Map<string, { pageNumber: number; durationMs: number }[]>();
  // Archived links still count: the document was read through them
  const links = await prisma.link.findMany({
    where: { documentId: { in: documentIds } },
    select: { id: true, documentId: true },
  });
  const byLink = await getPageReadings(links.map((link) => link.id));
  return readingsByDocument(byLink, new Map(links.map((link) => [link.id, link.documentId])));
}
