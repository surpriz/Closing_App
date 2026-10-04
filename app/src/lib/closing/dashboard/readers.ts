/**
 * Names for reading sessions. Pure. A known contact gets their name; a
 * reader who never gave an email gets a letter per browser, per link, in
 * order of first visit: two sessions marked "B" come from the same browser,
 * "A" and "B" from two browsers (often two people, or one person on two
 * devices).
 */

type ViewForLabel = {
  id: string;
  linkId: string;
  visitorId: string;
  startedAt: Date;
  email: string | null;
  prospect: { name: string | null; email: string } | null;
};

export type ReaderLabel = { name: string; identified: boolean };

export function labelReaders(views: ViewForLabel[]): Map<string, ReaderLabel> {
  const letters = new Map<string, string>();
  const perLink = new Map<string, number>();
  const labels = new Map<string, ReaderLabel>();

  for (const view of [...views].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())) {
    const known = view.prospect?.name ?? view.prospect?.email ?? view.email;
    if (known) {
      labels.set(view.id, { name: known, identified: true });
      continue;
    }
    const key = `${view.linkId}:${view.visitorId}`;
    let letter = letters.get(key);
    if (!letter) {
      const index = perLink.get(view.linkId) ?? 0;
      letter = String.fromCharCode(65 + Math.min(index, 25));
      perLink.set(view.linkId, index + 1);
      letters.set(key, letter);
    }
    labels.set(view.id, { name: `Lecteur non identifié ${letter}`, identified: false });
  }
  return labels;
}
