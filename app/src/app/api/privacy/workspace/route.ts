import { logAudit } from "@/lib/audit";
import { exportWorkspaceData } from "@/lib/privacy/workspace";
import { isManagerRole } from "@/lib/roles";
import { getWorkspace } from "@/lib/session";

export async function GET() {
  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });
  if (!isManagerRole(workspace.role)) return new Response("Forbidden", { status: 403 });

  const data = await exportWorkspaceData(workspace.organization.id);
  await logAudit({ organizationId: workspace.organization.id, actorUserId: workspace.user.id, action: "workspace.exported" });
  return Response.json(data, {
    headers: { "content-disposition": `attachment; filename="clozer-${workspace.organization.slug}.json"` },
  });
}
