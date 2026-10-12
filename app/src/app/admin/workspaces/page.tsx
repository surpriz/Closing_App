import type { Metadata } from "next";
import Link from "next/link";

import { AdminPagination } from "@/components/admin/pagination";
import { WorkspaceStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ADMIN_PAGE_SIZE,
  adminDate,
  firstParam,
  formatMicroUsd,
  parsePage,
  parseWorkspaceFilter,
} from "@/lib/admin/format";
import { aiCostLast30Days } from "@/lib/admin/workspaces";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Espaces" };

export default async function AdminWorkspacesPage({ searchParams }: PageProps<"/admin/workspaces">) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const statut = parseWorkspaceFilter(firstParam(params.statut));
  const page = parsePage(params.page);

  const where = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { slug: { contains: q, mode: "insensitive" as const } },
        { members: { some: { user: { email: { contains: q, mode: "insensitive" as const } } } } },
      ],
    }),
    ...(statut === "actif" && { suspendedAt: null }),
    ...(statut === "suspendu" && { suspendedAt: { not: null } }),
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
        plan: true,
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title [font-stretch:92%]">Espaces</h1>
        <form className="flex flex-wrap gap-2">
          <Input name="q" defaultValue={q} placeholder="Nom ou email d'un membre" aria-label="Recherche" className="w-60" />
          <select
            name="statut"
            defaultValue={statut ?? ""}
            aria-label="Statut"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Tous</option>
            <option value="actif">Actifs</option>
            <option value="suspendu">Suspendus</option>
          </select>
          <Button type="submit" variant="outline">
            Filtrer
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Espace</TableHead>
              <TableHead className="text-right">Membres</TableHead>
              <TableHead className="text-right">Liens</TableHead>
              <TableHead className="text-right">IA 30 j</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="pr-5">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((workspace) => (
              <TableRow key={workspace.id} className="relative">
                <TableCell className="pl-5">
                  <Link
                    href={`/admin/workspaces/${workspace.id}`}
                    className="font-medium outline-none after:absolute after:inset-0 hover:underline"
                  >
                    {workspace.name}
                  </Link>
                  <p className="text-small text-muted-foreground">{workspace.members[0]?.user.email ?? "Sans propriétaire"}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{workspace._count.members}</TableCell>
                <TableCell className="text-right tabular-nums">{workspace._count.links}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMicroUsd(costs.get(workspace.id) ?? 0)}</TableCell>
                <TableCell className="text-muted-foreground">{workspace.plan}</TableCell>
                <TableCell className="text-muted-foreground">{adminDate.format(workspace.createdAt)}</TableCell>
                <TableCell className="pr-5">
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
