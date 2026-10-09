import { findInventedDates, findInventedFigures, findTrackingHint, hasPlaceholder } from "../ai/guard";

/**
 * Checks an assistant answer after it streamed. Pure. The prospect has
 * already read it, so nothing is rewritten: the codes flag the answer for
 * the seller to check on the deal page.
 */

export type ChatFlag = "invented_figure" | "invented_date" | "tracking_hint" | "placeholder";

export const CHAT_FLAG_LABELS: Record<ChatFlag, string> = {
  invented_figure: "montant absent du document",
  invented_date: "date absente du document",
  tracking_hint: "allusion au suivi de lecture",
  placeholder: "texte à compléter",
};

export function lintChatAnswer(answer: string, sourceText: string): ChatFlag[] {
  const flags: ChatFlag[] = [];
  if (findInventedFigures(answer, sourceText).length) flags.push("invented_figure");
  if (findInventedDates(answer, sourceText).length) flags.push("invented_date");
  if (findTrackingHint(answer, { allowPageNumbers: true })) flags.push("tracking_hint");
  if (hasPlaceholder(answer)) flags.push("placeholder");
  return flags;
}
