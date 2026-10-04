import type { EngagementReason } from "../types";

/** Whether a stored score (`EngagementScore.reasons`, untyped JSON) carries a reason. */
export function hasReason(reasons: unknown, code: string) {
  return Array.isArray(reasons) && (reasons as EngagementReason[]).some((reason) => reason.code === code);
}
