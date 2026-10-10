/**
 * pageNumber of the welcome message: one clip for the whole document, shown
 * from the first page on. Page capsules (1-based) are no longer created but
 * the ones recorded before still play on their page.
 */
export const WELCOME_PAGE = 0;

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

/**
 * Prisma filter for the capsules one link may show: its document's, or its own. Never another link's.
 * A shared link only shows the document's: one recorded for a person must not play for everyone.
 */
export function capsulesVisibleOnLink(link: { id: string; documentId: string; shared?: boolean }) {
  if (link.shared) return { documentId: link.documentId, linkId: null };
  return { documentId: link.documentId, OR: [{ linkId: null }, { linkId: link.id }] };
}
