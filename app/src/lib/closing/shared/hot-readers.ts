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

type GroupedReader = ReaderReading & {
  email: string | null;
  /** Groups apart per Smart Link: the same address on two of them is two readers. */
  scope?: string | null;
  isOnboardingTest?: boolean;
  dealStatus?: string;
  engagementScore?: { tier: string } | null;
};

const TIER_RANK: Record<string, number> = { HOT: 3, WARM: 2, COLD: 1 };

/** The link that speaks for a person: a real one before a test, a decided deal, then the hottest, then the latest. */
function leads(a: GroupedReader, b: GroupedReader) {
  return (
    Number(!a.isOnboardingTest) - Number(!b.isOnboardingTest) ||
    Number((a.dealStatus ?? "OPEN") !== "OPEN") - Number((b.dealStatus ?? "OPEN") !== "OPEN") ||
    (TIER_RANK[a.engagementScore?.tier ?? ""] ?? 0) - (TIER_RANK[b.engagementScore?.tier ?? ""] ?? 0) ||
    a.lastActivityAt.getTime() - b.lastActivityAt.getTime()
  );
}

/**
 * One row per person: a reader opening from their phone, then their laptop,
 * gets a link per browser (reader-link.ts) but is one person. Grouped by
 * address, readings added up; the link that leads is the one that says the
 * most (see leads). Readers without an address stay alone. Pure.
 */
export function groupReadersByAddress<T extends GroupedReader>(readers: T[]) {
  const groups = new Map<string, { lead: T; readingMs: number; pricingMs: number; links: number; lastActivityAt: Date }>();
  for (const reader of readers) {
    const email = reader.email?.trim().toLowerCase();
    const key = email ? `${reader.scope ?? ""}:${email}` : `link:${reader.linkId}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { lead: reader, readingMs: reader.readingMs, pricingMs: reader.pricingMs, links: 1, lastActivityAt: reader.lastActivityAt });
      continue;
    }
    group.readingMs += reader.readingMs;
    group.pricingMs += reader.pricingMs;
    group.links += 1;
    if (reader.lastActivityAt > group.lastActivityAt) group.lastActivityAt = reader.lastActivityAt;
    if (leads(reader, group.lead) > 0) group.lead = reader;
  }
  return [...groups.values()].map(({ lead, readingMs, pricingMs, links, lastActivityAt }) => ({
    ...lead,
    readingMs,
    pricingMs,
    lastActivityAt,
    /** How many browsers or devices this person read from. */
    links,
  }));
}
