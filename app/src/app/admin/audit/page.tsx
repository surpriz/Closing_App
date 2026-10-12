import type { Metadata } from "next";
import Link from "next/link";

import { AuditList } from "@/components/admin/audit-list";
import { AdminPagination } from "@/components/admin/pagination";
import { loadAuditEntries } from "@/lib/admin/audit";
import { ADMIN_PAGE_SIZE, firstParam, parsePage } from "@/lib/admin/format";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal" };

const FILTERS = [
  { value: undefined, label: "Tout" },
  { value: "user", label: "Utilisateurs" },
  { value: "organization", label: "Espaces" },
  { value: "settings", label: "Inscriptions" },
] as const;

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const cible = FILTERS.find((filter) => filter.value && filter.value === firstParam(params.cible))?.value;
  const page = parsePage(params.page);
  const where = cible ? { targetType: cible } : {};

  const [total, entries] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    loadAuditEntries(where, { skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title [font-stretch:92%]">Journal</h1>
        <nav aria-label="Filtrer le journal" className="flex gap-1 text-sm">
          {FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={filter.value ? `/admin/audit?cible=${filter.value}` : "/admin/audit"}
              aria-current={filter.value === cible ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5",
                filter.value === cible ? "bg-card font-medium shadow-xs ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">
        <AuditList entries={entries} showTarget />
      </div>

      <AdminPagination path="/admin/audit" params={{ cible }} page={page} total={total} />
    </>
  );
}
