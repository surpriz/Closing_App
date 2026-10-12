import type { PageTag } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export type LinkReading = {
  readingMs: number;
  pricingMs: number;
  /** Sections read, the longest first. Never page numbers. */
  tags: PageTag[];
};

const EMPTY: LinkReading = { readingMs: 0, pricingMs: 0, tags: [] };

/** Real reading time per link of one document (readers of a shared link): crawlers and the seller left out. */
export async function readingByLink(linkIds: string[], documentId: string) {
  const result = new Map<string, LinkReading>();
  if (linkIds.length === 0) return result;

  const [rows, pages] = await Promise.all([
    prisma.pageView.groupBy({
      by: ["linkId", "pageNumber"],
      where: { linkId: { in: linkIds }, view: { isBot: false } },
      _sum: { totalDurationMs: true },
    }),
    prisma.documentPage.findMany({ where: { documentId }, select: { pageNumber: true, tags: true } }),
  ]);
  const tagsOf = new Map(pages.map((page) => [page.pageNumber, page.tags]));

  const tagTime = new Map<string, Map<PageTag, number>>();
  for (const row of rows) {
    const ms = row._sum.totalDurationMs ?? 0;
    const tags = tagsOf.get(row.pageNumber) ?? [];
    const reading = result.get(row.linkId) ?? { ...EMPTY, tags: [] };
    reading.readingMs += ms;
    if (tags.includes("PRICING")) reading.pricingMs += ms;
    result.set(row.linkId, reading);

    const byTag = tagTime.get(row.linkId) ?? new Map<PageTag, number>();
    for (const tag of tags) byTag.set(tag, (byTag.get(tag) ?? 0) + ms);
    tagTime.set(row.linkId, byTag);
  }
  for (const [linkId, byTag] of tagTime) {
    result.get(linkId)!.tags = [...byTag.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }
  return result;
}

export async function readingOfLink(linkId: string, documentId: string) {
  return (await readingByLink([linkId], documentId)).get(linkId) ?? EMPTY;
}
