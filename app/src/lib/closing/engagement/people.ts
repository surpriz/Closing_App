/**
 * How many people read, out of (browser, address) pairs: one address is one
 * person whatever the browsers, and a browser that read before and after
 * giving its address is that person too. Pure.
 */
export function countPeople(rows: { visitorId: string | null; email: string | null }[]) {
  const emailOfVisitor = new Map<string, string>();
  for (const row of rows) {
    if (row.visitorId && row.email) emailOfVisitor.set(row.visitorId, row.email.trim().toLowerCase());
  }
  const people = new Set<string>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() || (row.visitorId ? emailOfVisitor.get(row.visitorId) : undefined);
    people.add(email ?? `visitor:${row.visitorId ?? "unknown"}`);
  }
  return people.size;
}
