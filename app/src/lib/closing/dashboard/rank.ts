import { compareByUrgency, type NextAction } from "./next-action";

/**
 * Order of the "À traiter" list once the deal analysis is in. Pure.
 * What happens right now (a reader on the document, a change request, a
 * draft waiting) always comes first. Then the AI priority of each deal, for
 * deals whose analysis is still current; deals without one get a priority
 * from the rule-based action, so both kinds sort together.
 */

type RankedRow = {
  action: NextAction;
  score: number;
  lastActivityAt: Date | null;
  /** 1-5 from a current analysis, null when there is none. */
  aiPriority: number | null;
};

const REAL_TIME: NextAction["kind"][] = ["call_now", "reply", "review_draft"];

const RULE_PRIORITY: Record<NextAction["kind"], number> = {
  call_now: 5,
  reply: 5,
  review_draft: 5,
  call: 4,
  nudge: 3,
  followup_planned: 2,
  in_touch: 1,
  ai_advice: 2,
  wait: 1,
  snoozed: 0,
};

function priority(row: RankedRow) {
  // A snoozed deal stays at the bottom whatever the analysis said
  if (row.action.kind === "snoozed") return 0;
  return row.aiPriority ?? RULE_PRIORITY[row.action.kind];
}

export function compareDeals(a: RankedRow, b: RankedRow) {
  const aNow = REAL_TIME.indexOf(a.action.kind);
  const bNow = REAL_TIME.indexOf(b.action.kind);
  if (aNow !== -1 || bNow !== -1) {
    if (aNow === -1) return 1;
    if (bNow === -1) return -1;
    if (aNow !== bNow) return aNow - bNow;
  }
  return priority(b) - priority(a) || compareByUrgency(a, b);
}
