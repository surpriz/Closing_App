import { notFound } from "next/navigation";

import { getEnv } from "@/lib/env";
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { requireWorkspace } from "@/lib/session";

type Viewer = { email: string; emailVerified: boolean };

// Apollo and Lemlist licences cover internal use only until a resale deal is signed:
// prospecting is for the platform admin, and only in the workspaces listed in PROSPECTING_ORG_IDS.
// A teammate of that workspace, or the admin impersonating someone, does not see it.
export function isProspectingAllowed(
  viewer: Viewer,
  organizationId: string,
  { orgIds = getEnv().PROSPECTING_ORG_IDS, adminEmail = process.env.PLATFORM_ADMIN_EMAIL } = {},
) {
  if (!viewer.emailVerified || !isPlatformAdminEmail(viewer.email, adminEmail)) return false;
  const ids = (orgIds ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  return ids.includes(organizationId);
}

/** Pages and actions of the prospecting POC: a 404 for everyone else. */
export async function requireProspecting() {
  const workspace = await requireWorkspace("/prospection");
  if (!isProspectingAllowed(workspace.user, workspace.organization.id)) notFound();
  return workspace;
}
