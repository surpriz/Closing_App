import type { NextRequest } from "next/server";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { exportProspectData } from "@/lib/privacy/prospect";
import { isManagerRole } from "@/lib/roles";
import { getWorkspace } from "@/lib/session";

// Answers a prospect's access request: the seller downloads it and sends it on
export async function GET(request: NextRequest) {
  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });
  if (!isManagerRole(workspace.role)) return new Response("Forbidden", { status: 403 });

  const email = z.email().safeParse(request.nextUrl.searchParams.get("email") ?? "");
  if (!email.success) return new Response("Invalid email", { status: 400 });

  const data = await exportProspectData(workspace.organization.id, email.data);
  await logAudit({ organizationId: workspace.organization.id, actorUserId: workspace.user.id, action: "prospect.exported" });
  return Response.json(data, {
    headers: { "content-disposition": `attachment; filename="clozer-prospect-${data.email}.json"` },
  });
}
