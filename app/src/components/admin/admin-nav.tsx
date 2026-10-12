"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Vue d'ensemble", exact: true },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/workspaces", label: "Espaces" },
  { href: "/admin/audit", label: "Journal" },
  { href: "/admin/settings", label: "Inscriptions" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation admin" className="-mx-1 flex items-center gap-0.5 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              active
                ? "bg-card font-medium text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
