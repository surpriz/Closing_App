/**
 * Capsules a prospect closed, remembered per link in localStorage. By capsule
 * id: a capsule the seller records again shows again.
 */
const MAX_REMEMBERED = 50;

export function dismissalKey(slug: string) {
  return `cv_capsules_${slug}`;
}

export function parseDismissed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function addDismissed(ids: string[], id: string) {
  return ids.includes(id) ? ids : [...ids, id].slice(-MAX_REMEMBERED);
}
