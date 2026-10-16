import { prisma } from "@/lib/db";
import { deleteDocumentForever } from "@/lib/privacy/erase";
import { deleteWorkspace } from "@/lib/privacy/workspace";
import { isOwnerRole } from "@/lib/roles";

type Workspace = { id: string; name: string; members: { userId: string; role: string }[] };

/**
 * What deleting these users takes with them. A workspace left empty goes
 * entirely; in a workspace someone stays in, only their own documents go,
 * unless that would leave it without an owner.
 */
export function planUsersDeletion(userIds: string[], workspaces: Workspace[]) {
  const leaving = new Set(userIds);
  const emptied: string[] = [];
  const shared: string[] = [];
  const ownerless: string[] = [];

  for (const workspace of workspaces) {
    const staying = workspace.members.filter((m) => !leaving.has(m.userId));
    if (staying.length === 0) emptied.push(workspace.id);
    else if (
      !staying.some((m) => isOwnerRole(m.role)) &&
      workspace.members.some((m) => leaving.has(m.userId) && isOwnerRole(m.role))
    ) {
      ownerless.push(workspace.name);
    } else shared.push(workspace.id);
  }
  return { emptied, shared, ownerless };
}

export async function deleteUsersWithData(userIds: string[]) {
  const workspaces = await prisma.organization.findMany({
    where: { members: { some: { userId: { in: userIds } } } },
    select: { id: true, name: true, members: { select: { userId: true, role: true } } },
  });
  const plan = planUsersDeletion(userIds, workspaces);
  if (plan.ownerless.length) return { ownerless: plan.ownerless } as const;

  const documents = await prisma.document.findMany({
    where: { organizationId: { in: plan.shared }, ownerId: { in: userIds } },
    select: { id: true },
  });
  // Files first, then rows: a store failure leaves everything in place to retry
  for (const document of documents) await deleteDocumentForever(document.id);
  for (const id of plan.emptied) await deleteWorkspace(id);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  return { workspaces: plan.emptied.length, documents: documents.length } as const;
}
