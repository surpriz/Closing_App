/**
 * Per-page reading time turned into a thermal strip for a deal row. Pure.
 * Heat is each page's reading time relative to the most-read page (0–1), so the
 * strip always has one hottest page when anything was read.
 */

/** Past this, pages are folded into buckets so the strip stays readable on a row. */
export const MAX_PLATES = 12;

export type PageHeat = {
  /** One value per plate, 0–1. */
  heats: number[];
  /** Pages per plate: 1 unless the document had more than MAX_PLATES pages. */
  pagesPerPlate: number;
  /** The most-read page, null when nothing was read. */
  hottest: { page: number; seconds: number; plate: number } | null;
};

export function pageHeat(pages: { pageNumber: number; durationMs: number }[], numPages: number | null): PageHeat {
  const readMs = new Map<number, number>();
  for (const { pageNumber, durationMs } of pages) {
    if (pageNumber < 1 || durationMs <= 0) continue;
    readMs.set(pageNumber, (readMs.get(pageNumber) ?? 0) + durationMs);
  }
  const lastRead = Math.max(0, ...readMs.keys());
  const total = Math.max(numPages ?? 0, lastRead, 1);
  const pagesPerPlate = Math.ceil(total / MAX_PLATES);
  const plateCount = Math.ceil(total / pagesPerPlate);

  const plateMs = Array.from({ length: plateCount }, () => 0);
  let hottest: PageHeat["hottest"] = null;
  let hottestMs = 0;
  for (const [page, ms] of readMs) {
    const plate = Math.floor((page - 1) / pagesPerPlate);
    plateMs[plate] += ms;
    if (ms > hottestMs) {
      hottestMs = ms;
      hottest = { page, seconds: Math.round(ms / 1000), plate };
    }
  }
  const max = Math.max(...plateMs);
  return {
    heats: plateMs.map((ms) => (max > 0 ? ms / max : 0)),
    pagesPerPlate,
    hottest,
  };
}
