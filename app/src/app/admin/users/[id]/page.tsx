import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditList } from "@/components/admin/audit-list";
import { AdminSection } from "@/components/admin/section";
import { UserStatusBadge, WorkspaceStatusBadge } from "@/components/admin/status-badge";
import { UserActions } from "@/components/admin/user-actions";
import { ROLE_LABELS } from "@/components/dashboard/labels";
import { loadAuditEntries } from "@/lib/admin/audit";
import { adminDate, adminDateTime } from "@/lib/admin/format";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { isPlatformAdminEmail, normalizeEmail, userStatus } from "@/lib/platform-admin";

export const metadata: Metadata = { title: "Utilisateur" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      members: { include: { organization: { select: { id: true, name: true, suspendedAt: true } } } },
      sessions: { where: { expiresAt: { gt: now } }, orderBy: { updatedAt: "desc" } },
      extensionTokens: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) notFound();

  const [blocked, journal] = await Promise.all([
    prisma.blockedEmail.findUnique({ where: { email: normalizeEmail(user.email) } }),
    loadAuditEntries({ targetType: "user", targetId: user.id }),
  ]);
  const status = userStatus(user, blocked !== null, now);
  const isAdmin = isPlatformAdminEmail(user.email);

  return (
    <>
      <div className="space-y-3">
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Utilisateurs
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title [font-stretch:92%]">{user.email}</h1>
          <UserStatusBadge status={status} />
          {isAdmin && <span className="text-sm text-muted-foreground">Admin plateforme</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {user.name} · inscrit le {adminDate.format(user.createdAt)}
          {user.emailVerified ? "" : " · email non vérifié"}
        </p>
        {status !== "active" && (
          <p className="text-sm">
            {user.banReason && <>Motif : « {user.banReason} ». </>}
            {status === "disabled" && user.banExpires && <>Jusqu&apos;au {adminDateTime.format(user.banExpires)}.</>}
          </p>
        )}
        {!isAdmin && <UserActions userId={user.id} email={user.email} status={status} />}
      </div>

      <AdminSection title="Espaces">
        <ul className="divide-y divide-border">
          {user.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <Link href={`/admin/workspaces/${member.organization.id}`} className="font-medium hover:underline">
                {member.organization.name}
              </Link>
              <span className="flex items-center gap-3 text-muted-foreground">
                {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                <WorkspaceStatusBadge suspended={member.organization.suspendedAt !== null} />
              </span>
            </li>
          ))}
          {user.members.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">Aucun espace.</li>}
        </ul>
      </AdminSection>

      <AdminSection title="Sessions actives">
        <ul className="divide-y divide-border">
          {user.sessions.map((session) => (
            <li key={session.id} className="space-y-0.5 px-5 py-3 text-sm">
              <p className="truncate">{session.userAgent ?? "Navigateur inconnu"}</p>
              <p className="text-small text-muted-foreground">
                {session.ipAddress ?? "IP inconnue"} · vue le {adminDateTime.format(session.updatedAt)}
                {session.impersonatedBy && " · ouverte par l'admin"}
              </p>
            </li>
          ))}
          {user.sessions.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">Aucune session.</li>}
        </ul>
      </AdminSection>

      <AdminSection title="Extension et Outlook">
        <ul className="divide-y divide-border">
          {user.extensionTokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="truncate">
                {token.label ?? "Appareil"} <span className="font-mono text-muted-foreground">…{token.hint}</span>
              </span>
              <span className="shrink-0 text-small text-muted-foreground">
                {token.revokedAt
                  ? `révoqué le ${adminDate.format(token.revokedAt)}`
                  : token.lastUsedAt
                    ? `utilisé le ${adminDateTime.format(token.lastUsedAt)}`
                    : "jamais utilisé"}
              </span>
            </li>
          ))}
          {user.extensionTokens.length === 0 && (
            <li className="px-5 py-3 text-sm text-muted-foreground">Jamais connectée.</li>
          )}
        </ul>
      </AdminSection>

      <AdminSection title="Journal">
        <AuditList entries={journal} />
      </AdminSection>
    </>
  );
}
