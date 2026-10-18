import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilterBar } from "@/components/admin/filter-bar";
import { AdminPagination } from "@/components/admin/pagination";
import { WorkspaceStatusBadge } from "@/components/admin/status-badge";
import { ADMIN_CARD } from "@/components/admin/styles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ADMIN_PAGE_SIZE,
  adminDate,
  filterOptions,
  firstParam,
  formatMicroUsd,
  parseFilter,
  parsePage,
} from "@/lib/admin/format";
import { PLAN_SOURCE_LABELS, WORKSPACE_FILTERS, aiCostLast30Days } from "@/lib/admin/workspaces";
import { BILLING_SELECT, planFor } from "@/lib/billing/workspace-plan";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Espaces" };

export default async function AdminWorkspacesPage({ searchParams }: PageProps<"/admin/workspaces">) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const q = firstParam(params.q);
  const statut = parseFilter(WORKSPACE_FILTERS, firstParam(params.statut));
  const page = parsePage(params.page);

  const where = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { slug: { contains: q, mode: "insensitive" as const } },
        { members: { some: { user: { email: { contains: q, mode: "insensitive" as const } } } } },
      ],
    }),
    ...(statut && WORKSPACE_FILTERS[statut].where),
  };

  const [total, workspaces] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        ...BILLING_SELECT,
        createdAt: true,
        suspendedAt: true,
        members: { where: { role: { contains: "owner" } }, take: 1, select: { user: { select: { email: true } } } },
        _count: { select: { members: true, links: true } },
      },
    }),
  ]);
  const costs = await aiCostLast30Days(workspaces.map((workspace) => workspace.id));

  return (
    <>
      <AdminFilterBar
        title="Espaces"
        q={q}
        placeholder="Nom ou email d'un membre"
        statut={statut}
        options={filterOptions(WORKSPACE_FILTERS)}
      />

      <div className={ADMIN_CARD}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Espace</TableHead>
              <TableHead className="text-right">Membres</TableHead>
              <TableHead className="text-right">Liens</TableHead>
              <TableHead className="text-right">IA 30 j</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="pr-4">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((workspace) => (
              <TableRow key={workspace.id} className="relative">
                <TableCell className="pl-4">
                  <Link
                    href={`/admin/workspaces/${workspace.id}`}
                    className="font-semibold outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                  >
                    {workspace.name}
                  </Link>
                  <p className="text-small text-muted-foreground">{workspace.members[0]?.user.email ?? "Sans propriétaire"}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{workspace._count.members}</TableCell>
                <TableCell className="text-right tabular-nums">{workspace._count.links}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMicroUsd(costs.get(workspace.id) ?? 0)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {planFor(workspace).plan} · {PLAN_SOURCE_LABELS[planFor(workspace).source]}
                </TableCell>
                <TableCell className="text-muted-foreground">{adminDate.format(workspace.createdAt)}</TableCell>
                <TableCell className="pr-4">
                  <WorkspaceStatusBadge suspended={workspace.suspendedAt !== null} />
                </TableCell>
              </TableRow>
            ))}
            {workspaces.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucun espace.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination path="/admin/workspaces" params={{ q, statut }} page={page} total={total} />
    </>
  );
}
