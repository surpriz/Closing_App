import type { Metadata } from "next";
import Link from "next/link";

import { AdminSection } from "@/components/admin/section";
import { adminDate, formatMicroUsd } from "@/lib/admin/format";
import { loadBlockedEmails, userStatusWhere } from "@/lib/admin/users";
import { DAY_MS } from "@/lib/closing/constants";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Vue d'ensemble" };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-border">
      <p className="text-small text-muted-foreground">{label}</p>
      <p className="mt-1 text-title tabular-nums">{value}</p>
      {hint && <p className="text-small text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const blockedEmails = await loadBlockedEmails();

  const [
    users,
    signups7,
    signups30,
    active7,
    active30,
    disabled,
    workspaces,
    suspended,
    aiTotal,
    topCosts,
    latest,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(30) } } }),
    prisma.user.count({ where: { sessions: { some: { updatedAt: { gte: since(7) } } } } }),
    prisma.user.count({ where: { sessions: { some: { updatedAt: { gte: since(30) } } } } }),
    prisma.user.count({ where: userStatusWhere("disabled", blockedEmails, now) }),
    prisma.organization.count(),
    prisma.organization.count({ where: { suspendedAt: { not: null } } }),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: since(30) } }, _sum: { costMicroUsd: true } }),
    prisma.aiUsage.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: since(30) } },
      _sum: { costMicroUsd: true },
      orderBy: { _sum: { costMicroUsd: "desc" } },
      take: 10,
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, email: true, createdAt: true },
    }),
  ]);
  const names = new Map(
    (
      await prisma.organization.findMany({
        where: { id: { in: topCosts.map((row) => row.organizationId) } },
        select: { id: true, name: true },
      })
    ).map((org) => [org.id, org.name]),
  );

  return (
    <>
      <h1 className="text-title [font-stretch:92%]">Vue d&apos;ensemble</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Utilisateurs" value={users} hint={`+${signups7} en 7 j · +${signups30} en 30 j`} />
        <Stat label="Actifs sur 7 jours" value={active7} hint={`${active30} sur 30 jours`} />
        <Stat label="Espaces" value={workspaces} hint={suspended ? `${suspended} suspendu${suspended > 1 ? "s" : ""}` : undefined} />
        <Stat
          label="Coût IA 30 jours"
          value={formatMicroUsd(aiTotal._sum.costMicroUsd ?? 0)}
          hint={`${disabled} désactivé${disabled > 1 ? "s" : ""} · ${blockedEmails.length} banni${blockedEmails.length > 1 ? "s" : ""}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection title="Dernières inscriptions">
          <ul className="divide-y divide-border">
            {latest.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <Link href={`/admin/users/${user.id}`} className="truncate hover:underline">
                  {user.email}
                </Link>
                <span className="shrink-0 text-muted-foreground">{adminDate.format(user.createdAt)}</span>
              </li>
            ))}
          </ul>
        </AdminSection>

        <AdminSection title="Plus gros coûts IA sur 30 jours">
          <ul className="divide-y divide-border">
            {topCosts.map((row) => (
              <li key={row.organizationId} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <Link href={`/admin/workspaces/${row.organizationId}`} className="truncate hover:underline">
                  {names.get(row.organizationId) ?? "Espace supprimé"}
                </Link>
                <span className="shrink-0 tabular-nums">{formatMicroUsd(row._sum.costMicroUsd ?? 0)}</span>
              </li>
            ))}
            {topCosts.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">Aucun appel IA.</li>}
          </ul>
        </AdminSection>
      </div>
    </>
  );
}
