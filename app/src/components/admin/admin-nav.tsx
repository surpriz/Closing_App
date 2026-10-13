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
    <nav aria-label="Navigation admin" className="flex h-full items-stretch overflow-x-auto border-l border-border">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center border-r border-border px-4 text-small transition-colors duration-150 outline-none focus-visible:bg-muted",
              active
                ? "bg-card font-semibold text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
