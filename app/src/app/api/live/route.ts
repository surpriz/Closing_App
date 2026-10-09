import { getWorkspaceLiveState } from "@/lib/closing/live";
import { getWorkspace } from "@/lib/session";

export async function GET() {
  const workspace = await getWorkspace();
  if (!workspace) return new Response("Unauthorized", { status: 401 });

  // Same scope as the dashboard that polls it, or the stamps never match
  return Response.json(await getWorkspaceLiveState(workspace.organization.id, new Date(), workspace.scope), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
