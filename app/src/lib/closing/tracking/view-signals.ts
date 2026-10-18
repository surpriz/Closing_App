import type { ViewSignalType } from "@/generated/prisma/enums";

import { isSupportedLocale } from "../constants";

/** Time away from the tab counted as time on the site, at most. Beyond it the reader moved on. */
export const MAX_EXTERNAL_AWAY_MS = 30 * 60 * 1000;
/** A reader clicking around cannot fill the table. */
export const MAX_SIGNALS_PER_VIEW = 30;

/** Signals that mean something once per session: the next ones add nothing. */
export const ONCE_PER_VIEW: readonly ViewSignalType[] = ["DOWNLOAD", "EXIT_PROMPT_SHOWN", "EXIT_PROMPT_OPENED"];

/** Under a few seconds the reader only glanced at the other tab. */
const MIN_EXTERNAL_AWAY_MS = 3000;

/** The value kept for a signal, or undefined when the signal should be dropped. */
export function signalValue(type: ViewSignalType, valueMs: number | undefined): number | null | undefined {
  if (type !== "EXTERNAL_RETURN") return null;
  if (valueMs === undefined || valueMs < MIN_EXTERNAL_AWAY_MS) return undefined;
  return Math.min(Math.round(valueMs), MAX_EXTERNAL_AWAY_MS);
}

/**
 * The detail kept with a signal: the language of a translation, nothing for
 * the others. Undefined when a TRANSLATED signal names no language we offer.
 */
export function signalDetail(type: ViewSignalType, detail: string | undefined): string | null | undefined {
  if (type !== "TRANSLATED") return null;
  return isSupportedLocale(detail) ? detail : undefined;
}
