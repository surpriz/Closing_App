import type { PageTag } from "@/generated/prisma/enums";

import { TAG_NAMES } from "../brain/facts";

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

const FRICTION_NAMES: Record<string, string> = {
  PRICE: "le prix",
  SCOPE: "le périmètre",
  TIMING: "le calendrier",
  DECISION_MAKER: "le décideur",
  COMPETITION: "la concurrence",
  TRUST: "la confiance",
  STALLED_AT_SECTION: "une partie du document",
};
/** Below this many deals, a pattern is a coincidence. */
const MIN_DEALS = 2;

export function buildDocumentFrictions(input: DocumentFrictionInput): string[] {
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
      const about = tag ? TAG_NAMES[tag].toLowerCase() : info?.summary;
      lines.push(
        `${count} prospects sur ${opened.length} s'arrêtent à la page ${page}${about ? ` (${about})` : ""} : la suite n'est pas lue.`,
      );
    } else if (stops.size === 0) {
      lines.push(`Les ${opened.length} prospects qui ont ouvert sont allés jusqu'au bout.`);
    }
  }

  const byKind = new Map<string, number>();
  for (const kinds of input.aiFrictions) {
    for (const kind of new Set(kinds)) byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    if (count < MIN_DEALS || !FRICTION_NAMES[kind]) continue;
    lines.push(`L'analyse voit ${FRICTION_NAMES[kind]} comme un frein sur ${count} deals.`);
  }

  return lines.slice(0, 4);
}
