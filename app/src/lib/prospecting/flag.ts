import { notFound } from "next/navigation";

import { getEnv } from "@/lib/env";
import { requireWorkspace } from "@/lib/session";

// Apollo and Lemlist licences cover internal use only until a resale deal is signed:
// prospecting is on for the workspaces listed in PROSPECTING_ORG_IDS, nowhere else.
export function isProspectingEnabled(organizationId: string) {
  const ids = (getEnv().PROSPECTING_ORG_IDS ?? "").split(",").map((id) => id.trim());
  return ids.includes(organizationId);
}

/** Pages and actions of the prospecting POC: a 404 for every other workspace. */
export async function requireProspecting() {
  const workspace = await requireWorkspace("/prospection");
  if (!isProspectingEnabled(workspace.organization.id)) notFound();
  return workspace;
}
