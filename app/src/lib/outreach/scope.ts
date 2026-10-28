/**
 * What a tick may touch. `organizationIds` is the beta allowlist (kill switch): when set, nothing outside it runs, and
 * an empty list runs nothing at all. `deadline` is when the caller needs the tick to be over.
 */
export type OutreachScope = { organizationId?: string; organizationIds?: string[]; deadline?: Date };

/** The `organizationId` condition of a scope, for any model that carries one (directly or through a relation). */
export function organizationWhere(scope: OutreachScope): { organizationId?: string | { in: string[] } } {
  const { organizationId, organizationIds } = scope;
  if (organizationIds) {
    return { organizationId: { in: organizationId ? organizationIds.filter((id) => id === organizationId) : organizationIds } };
  }
  return organizationId ? { organizationId } : {};
}

/** Milliseconds left before the deadline (real clock), capped by `budgetMs`; never negative. */
export function budgetLeft(budgetMs: number, deadline?: Date): number {
  if (!deadline) return budgetMs;
  return Math.max(0, Math.min(budgetMs, deadline.getTime() - Date.now()));
}
