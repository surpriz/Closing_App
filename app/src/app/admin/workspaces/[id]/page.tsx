import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditList } from "@/components/admin/audit-list";
import { AdminSection } from "@/components/admin/section";
import { UserStatusBadge, WorkspaceStatusBadge } from "@/components/admin/status-badge";
import { WorkspaceActions } from "@/components/admin/workspace-actions";
import { ROLE_LABELS } from "@/components/dashboard/labels";
import { loadAuditEntries } from "@/lib/admin/audit";
import { adminDate, adminDateTime, formatMicroUsd } from "@/lib/admin/format";
import { loadBlockedEmails, statusOf } from "@/lib/admin/users";
import { aiCostLast30Days } from "@/lib/admin/workspaces";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Espace" };

export default async function AdminWorkspacePage({ params }: PageProps<"/admin/workspaces/[id]">) {
  const { id } = await params;
  const workspace = await prisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, email: true, name: true, banned: true, banExpires: true } } },
      },
      _count: { select: { links: true, documents: true } },
    },
  });
  if (!workspace) notFound();

  const [blockedEmails, costs, journal] = await Promise.all([
    loadBlockedEmails(),
    aiCostLast30Days([workspace.id]),
    loadAuditEntries({ targetType: "organization", targetId: workspace.id }),
  ]);
  const blocked = new Set(blockedEmails);
  const suspended = workspace.suspendedAt !== null;

  return (
    <>
      <div className="space-y-3">
        <Link href="/admin/workspaces" className="text-sm text-muted-foreground hover:text-foreground">
          ← Espaces
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title [font-stretch:92%]">{workspace.name}</h1>
          <WorkspaceStatusBadge suspended={suspended} />
        </div>
        <p className="text-sm text-muted-foreground">
          Créé le {adminDate.format(workspace.createdAt)} · plan {workspace.plan} · {workspace._count.documents}{" "}
          documents · {workspace._count.links} liens · IA 30 j {formatMicroUsd(costs.get(workspace.id) ?? 0)}
        </p>
        {suspended && workspace.suspendedAt && (
          <p className="text-sm">
            Suspendu le {adminDateTime.format(workspace.suspendedAt)}
            {workspace.suspendedReason && <> : « {workspace.suspendedReason} »</>}
          </p>
        )}
        <WorkspaceActions id={workspace.id} name={workspace.name} suspended={suspended} />
      </div>

      <AdminSection title="Membres">
        <ul className="divide-y divide-border">
          {workspace.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/admin/users/${member.user.id}`} className="font-medium hover:underline">
                  {member.user.email}
                </Link>
                <p className="truncate text-small text-muted-foreground">{member.user.name}</p>
              </div>
              <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                <UserStatusBadge status={statusOf(member.user, blocked)} />
              </span>
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection title="Journal">
        <AuditList entries={journal} />
      </AdminSection>
    </>
  );
}
