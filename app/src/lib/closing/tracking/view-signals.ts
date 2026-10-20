import type { ViewSignalType } from "@/generated/prisma/enums";

import { isSupportedLocale } from "../constants";

/** Time away from the tab counted as time on the site, at most. Beyond it the reader moved on. */
export const MAX_EXTERNAL_AWAY_MS = 30 * 60 * 1000;
/** A reader clicking around cannot fill the table. */
export const MAX_SIGNALS_PER_VIEW = 30;

/** Signals that mean something once per session: the next ones add nothing. */
export const ONCE_PER_VIEW: readonly ViewSignalType[] = ["DOWNLOAD", "EXIT_PROMPT_SHOWN", "EXIT_PROMPT_OPENED", "PRINT"];
/** Once per value of their detail: a translation per language, a copy per page. */
export const ONCE_PER_DETAIL: readonly ViewSignalType[] = ["TRANSLATED", "COPY_TEXT"];

/** A copied word or two is a misclick; a sentence is a passage taken away. */
const MIN_COPIED_CHARS = 20;
const MAX_COPIED_CHARS = 100_000;

/** Under a few seconds the reader only glanced at the other tab. */
const MIN_EXTERNAL_AWAY_MS = 3000;

/** The value kept for a signal, or undefined when the signal should be dropped. */
export function signalValue(type: ViewSignalType, valueMs: number | undefined): number | null | undefined {
  // COPY_TEXT: characters copied, carried in valueMs
  if (type === "COPY_TEXT") {
    if (valueMs === undefined || valueMs < MIN_COPIED_CHARS) return undefined;
    return Math.min(Math.round(valueMs), MAX_COPIED_CHARS);
  }
  if (type !== "EXTERNAL_RETURN") return null;
  if (valueMs === undefined || valueMs < MIN_EXTERNAL_AWAY_MS) return undefined;
  return Math.min(Math.round(valueMs), MAX_EXTERNAL_AWAY_MS);
}

/**
 * The detail kept with a signal: the language of a translation, the page of a
 * copy, nothing for the others. Undefined when a TRANSLATED signal names no language we offer.
 */
export function signalDetail(type: ViewSignalType, detail: string | undefined): string | null | undefined {
  // COPY_TEXT: the page it was copied from
  if (type === "COPY_TEXT") return detail && /^[1-9]\d{0,3}$/.test(detail) ? detail : null;
  if (type !== "TRANSLATED") return null;
  return isSupportedLocale(detail) ? detail : undefined;
}
