import { getWorkspaceLiveState } from "@/lib/closing/live";
import { getWorkspace } from "@/lib/session";

export async function GET() {
  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });

  return Response.json(await getWorkspaceLiveState(workspace.organization.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
