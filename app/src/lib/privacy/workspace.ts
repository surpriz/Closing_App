import { listPrivateBlobPaths, organizationPrefix } from "@/lib/blob";
import { prisma } from "@/lib/db";
import { isOwnerRole } from "@/lib/roles";

import { deleteBlobs } from "./erase";

// Portability: everything the workspace typed or collected, in one JSON file
export async function exportWorkspaceData(organizationId: string) {
  const [organization, settings, members, documents, links] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, slug: true, createdAt: true } }),
    prisma.workspaceSettings.findUnique({
      where: { organizationId },
      omit: { slackWebhookUrl: true, webhookSecret: true },
    }),
    prisma.member.findMany({
      where: { organizationId },
      select: { role: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.document.findMany({
      where: { organizationId },
      select: { id: true, name: true, kind: true, createdAt: true, archivedAt: true },
    }),
    prisma.link.findMany({
      where: { organizationId },
      include: {
        prospects: true,
        views: { omit: { visitorId: true, ipHash: true }, include: { pageViews: true } },
        chatMessages: { select: { viewId: true, role: true, content: true, createdAt: true } },
        voiceComments: { select: { viewId: true, pageNumber: true, transcript: true, createdAt: true } },
        actions: { omit: { signerIpHash: true } },
        followups: { select: { prospectId: true, channel: true, status: true, subject: true, body: true, sentAt: true } },
        sellerActivities: true,
      },
    }),
  ]);
  return { exportedAt: new Date().toISOString(), organization, settings, members, documents, links };
}

// Owners only. The database cascades do the rows; the files are listed by prefix
// so nothing stays behind in the store. Members left without a workspace go too.
export async function deleteWorkspace(organizationId: string) {
  const members = await prisma.member.findMany({ where: { organizationId }, select: { userId: true } });

  await deleteBlobs(await listPrivateBlobPaths(organizationPrefix(organizationId)));
  await prisma.$transaction([
    prisma.aiUsage.deleteMany({ where: { organizationId } }),
    prisma.organization.delete({ where: { id: organizationId } }),
  ]);

  const userIds = members.map((m) => m.userId);
  const { count } = await prisma.user.deleteMany({ where: { id: { in: userIds }, members: { none: {} } } });
  return { usersDeleted: count };
}

type Membership = { role: string; organization: { name: string; members: { userId: string; role: string }[] } };

// A workspace may not lose its last owner while others still work in it
export function findDeletionBlocker(userId: string, memberships: Membership[]) {
  for (const { role, organization } of memberships) {
    if (!isOwnerRole(role)) continue;
    const others = organization.members.filter((m) => m.userId !== userId);
    if (others.length === 0) return { kind: "sole_member" as const, workspace: organization.name };
    if (!others.some((m) => isOwnerRole(m.role))) return { kind: "last_owner" as const, workspace: organization.name };
  }
  return null;
}

export async function accountDeletionBlocker(userId: string) {
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: {
      role: true,
      organization: { select: { name: true, members: { select: { userId: true, role: true } } } },
    },
  });
  return findDeletionBlocker(userId, memberships);
}

// Links and documents stay with the workspace (creator/owner set to null by the schema)
export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}
