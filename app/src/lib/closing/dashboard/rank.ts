import { compareByUrgency, isLive, type NextAction } from "./next-action";

/**
 * Order of the "À traiter" list once the deal analysis is in. Pure.
 * What happens right now (a signature to confirm, a reader on the document,
 * a prospect back on a dead link, a change request, a draft waiting) always comes first. Then the AI priority of each deal, for
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

const REAL_TIME: NextAction["kind"][] = ["close_won", "call_now", "reactivate", "reply", "review_draft"];

const RULE_PRIORITY: Record<NextAction["kind"], number> = {
  close_won: 5,
  call_now: 5,
  reactivate: 5,
  reply: 5,
  review_draft: 5,
  call: 4,
  identify: 4,
  nudge: 3,
  followup_planned: 2,
  meeting_booked: 1,
  in_touch: 1,
  campaign: 1,
  ai_advice: 2,
  wait: 1,
  snoozed: 0,
};

function priority(row: RankedRow) {
  // A snoozed deal stays at the bottom whatever the analysis said
  if (row.action.kind === "snoozed") return 0;
  return row.aiPriority ?? RULE_PRIORITY[row.action.kind];
}

/** Position among the facts of the moment, -1 when not one. An unknown reader live ranks with a call. */
function realTime(action: NextAction) {
  return isLive(action) ? REAL_TIME.indexOf("call_now") : REAL_TIME.indexOf(action.kind);
}

export function compareDeals(a: RankedRow, b: RankedRow) {
  const aNow = realTime(a.action);
  const bNow = realTime(b.action);
  if (aNow !== -1 || bNow !== -1) {
    if (aNow === -1) return 1;
    if (bNow === -1) return -1;
    if (aNow !== bNow) return aNow - bNow;
  }
  return priority(b) - priority(a) || compareByUrgency(a, b);
}
