/**
 * Reading time gathered per document for its thermal strip. Pure.
 * Each link's per-page readings are folded into its document; pageHeat sums
 * the repeated page numbers, so the strip shows every prospect's reading at once.
 */

export type PageReading = { pageNumber: number; durationMs: number };

export function readingsByDocument(
  byLink: Map<string, PageReading[]>,
  documentOf: Map<string, string>,
): Map<string, PageReading[]> {
  const byDocument = new Map<string, PageReading[]>();
  for (const [linkId, pages] of byLink) {
    const documentId = documentOf.get(linkId);
    if (!documentId) continue;
    const list = byDocument.get(documentId) ?? [];
    list.push(...pages);
    byDocument.set(documentId, list);
  }
  return byDocument;
}

/** Reading time as an instrument reads it: "42 s", "3 min 08". */
export function formatReadTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`;
}
