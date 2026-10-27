import { notFound } from "next/navigation";

import { getEnv } from "@/lib/env";
import { requireWorkspace } from "@/lib/session";

/** Beta is per workspace: every verified member of a listed one gets in, no platform-admin condition. */
export function isOutreachAllowed(
  viewer: { emailVerified: boolean },
  organizationId: string,
  { orgIds = getEnv().OUTREACH_ORG_IDS } = {},
) {
  if (!viewer.emailVerified) return false;
  const ids = (orgIds ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  return ids.includes(organizationId);
}

/** Pages and actions of the native cold email beta: a 404 for everyone else. */
export async function requireOutreach() {
  const workspace = await requireWorkspace("/settings");
  if (!isOutreachAllowed(workspace.user, workspace.organization.id)) notFound();
  return workspace;
}
