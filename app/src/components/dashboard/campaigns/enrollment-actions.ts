export type EnrollmentAction = "openLink" | "resendStep" | "skipStep" | "pause" | "resume" | "remove";

const REMOVABLE = ["QUEUED", "ACTIVE", "PAUSED"];

/**
 * What the row's menu may offer, in order. Pure, so the table can hide the menu when there is
 * nothing to offer instead of opening an empty one.
 */
export function enrollmentActions(
  row: { status: string; linkId: string | null; blockedStep: boolean },
  disabled: boolean,
): EnrollmentAction[] {
  const actions: EnrollmentAction[] = [];
  if (row.linkId) actions.push("openLink");
  if (disabled) return actions;
  if (row.status === "ACTIVE" && row.blockedStep) actions.push("resendStep", "skipStep");
  if (row.status === "ACTIVE") actions.push("pause");
  if (row.status === "PAUSED") actions.push("resume");
  if (REMOVABLE.includes(row.status)) actions.push("remove");
  return actions;
}
