import { notFound } from "next/navigation";

import { getEnv } from "@/lib/env";
import { requireWorkspace } from "@/lib/session";

/** The value of OUTREACH_ORG_IDS that opens campaigns to every workspace (the plan gate still applies). */
export const OUTREACH_EVERYONE = "*";

/**
 * The workspaces allowed to run campaigns, from OUTREACH_ORG_IDS: a comma-separated list of ids, or `*` for every
 * workspace (then `undefined`: no filter). Empty when unset: nothing is allowed, which is the kill switch.
 */
export function outreachOrgIds({ OUTREACH_ORG_IDS }: { OUTREACH_ORG_IDS?: string } = getEnv()): string[] | undefined {
  if ((OUTREACH_ORG_IDS ?? "").trim() === OUTREACH_EVERYONE) return undefined;
  return (OUTREACH_ORG_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
}

/** Whether a workspace may run campaigns: listed, or everyone is. */
export function isOutreachOrg(organizationId: string, env: { OUTREACH_ORG_IDS?: string } = getEnv()) {
  const ids = outreachOrgIds(env);
  return ids === undefined || ids.includes(organizationId);
}

/** Per workspace: every verified member of an allowed one gets in, no platform-admin condition. */
export function isOutreachAllowed(
  viewer: { emailVerified: boolean },
  organizationId: string,
  { orgIds = getEnv().OUTREACH_ORG_IDS } = {},
) {
  if (!viewer.emailVerified) return false;
  return isOutreachOrg(organizationId, { OUTREACH_ORG_IDS: orgIds });
}

/** Pages and actions of the native cold email: a 404 for workspaces outside OUTREACH_ORG_IDS. */
export async function requireOutreach() {
  const workspace = await requireWorkspace("/settings");
  if (!isOutreachAllowed(workspace.user, workspace.organization.id)) notFound();
  return workspace;
}
