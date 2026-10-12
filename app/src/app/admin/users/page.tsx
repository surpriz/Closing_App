import type { Metadata } from "next";
import Link from "next/link";

import { AdminPagination } from "@/components/admin/pagination";
import { UserStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_PAGE_SIZE, adminDate, adminDateTime, firstParam, parsePage } from "@/lib/admin/format";
import { STATUS_FILTERS, loadBlockedEmails, parseStatusFilter, statusOf, userStatusWhere } from "@/lib/admin/users";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const statut = parseStatusFilter(firstParam(params.statut));
  const page = parsePage(params.page);
  const now = new Date();
  const blockedEmails = await loadBlockedEmails();
  const blocked = new Set(blockedEmails);

  const where = {
    AND: [
      q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      statut ? userStatusWhere(STATUS_FILTERS[statut], blockedEmails, now) : {},
    ],
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        banned: true,
        banExpires: true,
        members: { select: { organization: { select: { name: true } } } },
        sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
      },
    }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title [font-stretch:92%]">Utilisateurs</h1>
        <form className="flex flex-wrap gap-2">
          <Input name="q" defaultValue={q} placeholder="Email ou nom" aria-label="Recherche" className="w-56" />
          <select
            name="statut"
            defaultValue={statut ?? ""}
            aria-label="Statut"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Tous</option>
            <option value="actif">Actifs</option>
            <option value="desactive">Désactivés</option>
            <option value="banni">Bannis</option>
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
              <TableHead className="pl-5">Utilisateur</TableHead>
              <TableHead>Espaces</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead>Dernière activité</TableHead>
              <TableHead className="pr-5">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="relative">
                <TableCell className="pl-5">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-medium outline-none after:absolute after:inset-0 hover:underline"
                  >
                    {user.email}
                  </Link>
                  <p className="text-small text-muted-foreground">{user.name}</p>
                </TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {user.members.map((member) => member.organization.name).join(", ") || "–"}
                </TableCell>
                <TableCell className="text-muted-foreground">{adminDate.format(user.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {user.sessions[0] ? adminDateTime.format(user.sessions[0].updatedAt) : "–"}
                </TableCell>
                <TableCell className="pr-5">
                  <UserStatusBadge status={statusOf(user, blocked, now)} />
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucun utilisateur.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination path="/admin/users" params={{ q, statut }} page={page} total={total} />
    </>
  );
}
