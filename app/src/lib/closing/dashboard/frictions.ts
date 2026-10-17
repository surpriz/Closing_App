import type { PageTag } from "@/generated/prisma/enums";

import type { AppT } from "./i18n";

/**
 * What blocks prospects on one document, across all its links. Pure. Tells
 * the seller when the problem is the proposal itself (everyone stops at the
 * same page, the price comes up on every deal), not one prospect.
 */

export type DocumentFrictionInput = {
  numPages: number;
  pages: { pageNumber: number; tags: PageTag[]; summary: string | null }[];
  /** One per link; furthestPage null when the link was never opened. */
  deals: { furthestPage: number | null }[];
  /** Friction kinds from the latest analysis of each deal, one list per deal. */
  aiFrictions: string[][];
};

const FRICTION_KINDS = new Set([
  "PRICE",
  "SCOPE",
  "TIMING",
  "DECISION_MAKER",
  "COMPETITION",
  "TRUST",
  "STALLED_AT_SECTION",
]);
/** Below this many deals, a pattern is a coincidence. */
const MIN_DEALS = 2;

export function buildDocumentFrictions(input: DocumentFrictionInput, t: AppT): string[] {
  const lines: string[] = [];
  const opened = input.deals.filter((deal) => deal.furthestPage !== null);

  if (input.numPages > 1 && opened.length >= MIN_DEALS) {
    const stops = new Map<number, number>();
    for (const deal of opened) {
      if (deal.furthestPage! < input.numPages) stops.set(deal.furthestPage!, (stops.get(deal.furthestPage!) ?? 0) + 1);
    }
    const [page, count] = [...stops.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [0, 0];
    if (count >= MIN_DEALS) {
      const info = input.pages.find((p) => p.pageNumber === page);
      const tag = info?.tags.find((t) => t !== "OTHER");
      const about = tag ? t(`labels.tag.${tag}`).toLowerCase() : info?.summary;
      const values = { count, total: opened.length, page };
      lines.push(
        about ? t("today.frictions.stopsAbout", { ...values, about }) : t("today.frictions.stops", values),
      );
    } else if (stops.size === 0) {
      lines.push(t("today.frictions.allFinished", { count: opened.length }));
    }
  }

  const byKind = new Map<string, number>();
  for (const kinds of input.aiFrictions) {
    for (const kind of new Set(kinds)) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    if (count < MIN_DEALS || !FRICTION_KINDS.has(kind)) continue;
    lines.push(t("today.frictions.aiFriction", { friction: t(`today.frictions.names.${kind}` as never), count }));
  }

  return lines.slice(0, 4);
}
