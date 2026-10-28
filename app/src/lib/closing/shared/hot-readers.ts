/**
 * Hot lead dispatch on a shared link: out of everyone who clicked, the few who
 * stayed. A reader is hot past the pricing threshold on the pricing pages, or
 * on the whole document. Pure.
 */

export type ReaderReading = {
  linkId: string;
  readingMs: number;
  pricingMs: number;
  lastActivityAt: Date;
};

export function isHotReader(reader: { readingMs: number; pricingMs: number }, thresholdSec: number) {
  const threshold = thresholdSec * 1000;
  return reader.pricingMs >= threshold || reader.readingMs >= threshold;
}

/** Hot readers first, longest on pricing then longest overall; then the latest active. */
export function rankSharedReaders<T extends ReaderReading>(readers: T[], thresholdSec: number) {
  return readers
    .map((reader) => ({ ...reader, hot: isHotReader(reader, thresholdSec) }))
    .sort((a, b) => {
      if (a.hot !== b.hot) return a.hot ? -1 : 1;
      if (a.hot) return b.pricingMs - a.pricingMs || b.readingMs - a.readingMs;
      return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
    });
}

/**
 * One row per person: a reader opening from their phone, then their laptop,
 * gets a link per browser (reader-link.ts) but is one person. Grouped by
 * address, readings added up, the most recently active link leads. Readers
 * without an address stay alone. Pure.
 */
export function groupReadersByAddress<T extends ReaderReading & { email: string | null }>(readers: T[]) {
  const groups = new Map<string, { lead: T; readingMs: number; pricingMs: number; links: number }>();
  for (const reader of readers) {
    const key = reader.email?.trim().toLowerCase() || `link:${reader.linkId}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { lead: reader, readingMs: reader.readingMs, pricingMs: reader.pricingMs, links: 1 });
      continue;
    }
    group.readingMs += reader.readingMs;
    group.pricingMs += reader.pricingMs;
    group.links += 1;
    if (reader.lastActivityAt > group.lead.lastActivityAt) group.lead = reader;
  }
  return [...groups.values()].map(({ lead, readingMs, pricingMs, links }) => ({
    ...lead,
    readingMs,
    pricingMs,
    /** How many browsers or devices this person read from. */
    links,
  }));
}
