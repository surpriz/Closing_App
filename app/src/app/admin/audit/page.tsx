import type { Metadata } from "next";
import Link from "next/link";

import { AuditList } from "@/components/admin/audit-list";
import { AdminPagination } from "@/components/admin/pagination";
import { ADMIN_CARD } from "@/components/admin/styles";
import { loadAuditEntries } from "@/lib/admin/audit";
import { ADMIN_PAGE_SIZE, filterOptions, firstParam, parseFilter, parsePage, type FilterMap } from "@/lib/admin/format";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal" };

const AUDIT_FILTERS = {
  user: { label: "Utilisateurs" },
  organization: { label: "Espaces" },
  settings: { label: "Inscriptions" },
} satisfies FilterMap;

const TABS = [{ value: undefined, label: "Tout" }, ...filterOptions(AUDIT_FILTERS)];

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const cible = parseFilter(AUDIT_FILTERS, firstParam(params.cible));
  const page = parsePage(params.page);
  const where = cible ? { targetType: cible } : {};

  const [total, entries] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    loadAuditEntries(where, { skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title condensed">Journal</h1>
        <nav aria-label="Filtrer le journal" className="flex border border-border text-small">
          {TABS.map((filter) => (
            <Link
              key={filter.label}
              href={filter.value ? `/admin/audit?cible=${filter.value}` : "/admin/audit"}
              aria-current={filter.value === cible ? "page" : undefined}
              className={cn(
                "border-r border-border px-3 py-1 transition-colors outline-none last:border-r-0 focus-visible:ring-3 focus-visible:ring-ring/30",
                filter.value === cible
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={ADMIN_CARD}>
        <AuditList entries={entries} showTarget />
      </div>

      <AdminPagination path="/admin/audit" params={{ cible }} page={page} total={total} />
    </>
  );
}
