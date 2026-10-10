/** scopeKey of a capsule shown on every link of its document. */
export const DOCUMENT_SCOPE = "doc";

export function capsuleScopeKey(linkId: string | null | undefined) {
  return linkId ?? DOCUMENT_SCOPE;
}

/**
 * The capsule each page shows on one link: the link's own one when the
 * seller recorded it, otherwise the document's. Pure.
 */
export function resolveCapsules<T extends { pageNumber: number; linkId: string | null }>(rows: T[], linkId: string) {
  const byPage = new Map<number, T>();
  for (const row of rows) {
    if (row.linkId !== null && row.linkId !== linkId) continue;
    const current = byPage.get(row.pageNumber);
    if (!current || (current.linkId === null && row.linkId === linkId)) byPage.set(row.pageNumber, row);
  }
  return byPage;
}

/** Prisma filter for the capsules one link may show: its document's, or its own. Never another link's. */
export function capsulesVisibleOnLink(link: { id: string; documentId: string }) {
  return { documentId: link.documentId, OR: [{ linkId: null }, { linkId: link.id }] };
}
