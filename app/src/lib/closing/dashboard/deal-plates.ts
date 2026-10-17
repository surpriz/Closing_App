import type { UiLocale } from "@/i18n/locale";

import { segmentLabel } from "../documents/video-segments";

import { pageHeat, type PageHeat } from "./page-heat";

/**
 * The deal page's thermal band: one plate per page (or per bucket of pages on
 * a long document, per tenth on a video pitch) with its measured reading time.
 * Pure: everything comes from the reading data already loaded by the page.
 */

export type DealPlate = {
  /** 0-based position in the band. */
  index: number;
  /** First and last page the plate covers (1-based, equal unless the document was folded). */
  from: number;
  to: number;
  /** "P.4", "P.13–15", or "20–30 %" on a video. */
  label: string;
  /** Total reading time on the plate's pages, all sessions. */
  seconds: number;
  /** Average per reading session, single-page plates only. */
  avgSeconds: number | null;
  /** 0–1, relative to the most-read plate. */
  heat: number;
  pricing: boolean;
  /** What the page is about, single-page plates only. */
  summary: string | null;
  /** The reticle goes here. */
  hottest: boolean;
  /** Someone has this page open right now. */
  live: boolean;
};

export type DealPlates = {
  plates: DealPlate[];
  pagesPerPlate: number;
  hottest: PageHeat["hottest"];
  /** Sum of every page's reading time. */
  totalSeconds: number;
};

export function dealPlates(input: {
  /** Reading time per page, bots left out (getLinkAnalytics().pages). */
  pages: { pageNumber: number; totalDurationMs: number; viewCount: number }[];
  /** The document's own pages, for the pricing tag and the AI summary. */
  documentPages: {
    pageNumber: number;
    isPricing: boolean;
    summary: string | null;
  }[];
  numPages: number | null;
  video: boolean;
  locale: UiLocale;
  /** Pages open right now. */
  livePages?: number[];
}): DealPlates {
  const heat = pageHeat(
    input.pages.map((page) => ({
      pageNumber: page.pageNumber,
      durationMs: page.totalDurationMs,
    })),
    input.numPages ?? (input.documentPages.length || null),
  );
  const stats = new Map(input.pages.map((page) => [page.pageNumber, page]));
  const meta = new Map(
    input.documentPages.map((page) => [page.pageNumber, page]),
  );
  const live = new Set(input.livePages ?? []);
  const span = heat.pagesPerPlate;
  const lastPage = Math.max(
    input.numPages ?? input.documentPages.length,
    ...input.pages
      .filter((page) => page.totalDurationMs > 0)
      .map((page) => page.pageNumber),
    1,
  );

  const plates = heat.heats.map((value, index): DealPlate => {
    const from = index * span + 1;
    const to = Math.min(from + span - 1, lastPage);
    let ms = 0;
    let pricing = false;
    let isLive = false;
    for (let page = from; page <= to; page++) {
      ms += Math.max(0, stats.get(page)?.totalDurationMs ?? 0);
      pricing ||= meta.get(page)?.isPricing ?? false;
      isLive ||= live.has(page);
    }
    const single = span === 1 ? stats.get(from) : undefined;
    return {
      index,
      from,
      to,
      label: plateLabel(from, to, input.video, input.locale),
      seconds: Math.round(ms / 1000),
      avgSeconds:
        single && single.viewCount > 0
          ? Math.round(single.totalDurationMs / single.viewCount / 1000)
          : null,
      heat: value,
      pricing,
      summary: span === 1 ? (meta.get(from)?.summary ?? null) : null,
      hottest: heat.hottest?.plate === index,
      live: isLive,
    };
  });

  return {
    plates,
    pagesPerPlate: span,
    hottest: heat.hottest,
    totalSeconds: plates.reduce((sum, plate) => sum + plate.seconds, 0),
  };
}

function plateLabel(from: number, to: number, video: boolean, locale: UiLocale) {
  // A video pitch is ten pages, one per tenth: never folded
  if (video) return segmentLabel(from, undefined, locale);
  return from === to ? `P.${from}` : `P.${from}–${to}`;
}

/** Reading time as an instrument reads it: "0:42", "3:38", "1:02:05". */
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
