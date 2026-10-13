import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilterBar } from "@/components/admin/filter-bar";
import { AdminPagination } from "@/components/admin/pagination";
import { UserStatusBadge } from "@/components/admin/status-badge";
import { ADMIN_CARD } from "@/components/admin/styles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ADMIN_PAGE_SIZE,
  adminDate,
  adminDateTime,
  filterOptions,
  firstParam,
  parseFilter,
  parsePage,
} from "@/lib/admin/format";
import { USER_FILTERS, loadBlockedEmails, statusOf, userStatusWhere } from "@/lib/admin/users";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const q = firstParam(params.q);
  const statut = parseFilter(USER_FILTERS, firstParam(params.statut));
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
      statut ? userStatusWhere(USER_FILTERS[statut].status, blockedEmails, now) : {},
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
      <AdminFilterBar
        title="Utilisateurs"
        q={q}
        placeholder="Email ou nom"
        statut={statut}
        options={filterOptions(USER_FILTERS)}
      />

      <div className={ADMIN_CARD}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Utilisateur</TableHead>
              <TableHead>Espaces</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead>Dernière activité</TableHead>
              <TableHead className="pr-4">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="relative">
                <TableCell className="pl-4">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-semibold outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
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
                <TableCell className="pr-4">
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
