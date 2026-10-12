import type { DocumentKind } from "@/generated/prisma/enums";

/** Seconds a video pitch must last before a chart of its passages says anything. */
export const VIDEO_DETAIL_MIN_MS = 30_000;

/**
 * Whether the time-per-page chart is worth a look: two pages with time on a
 * document, or a video of 30 s or more that someone watched. Pure.
 */
export function showsReadingDetail(input: {
  kind: DocumentKind;
  durationMs: number | null;
  viewCount: number;
  pagesWithTime: number;
}): boolean {
  if (input.viewCount === 0) return false;
  if (input.kind === "URL") return false;
  if (input.kind === "VIDEO") return (input.durationMs ?? 0) >= VIDEO_DETAIL_MIN_MS;
  return input.pagesWithTime >= 2;
}
