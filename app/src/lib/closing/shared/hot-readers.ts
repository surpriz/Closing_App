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
