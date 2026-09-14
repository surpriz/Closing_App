"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", match: ["/dashboard", "/links"] },
  { href: "/documents", label: "Documents", match: ["/documents"] },
  { href: "/settings", label: "Paramètres", match: ["/settings"] },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 overflow-x-auto text-sm">
      {ITEMS.map((item) => {
        const active = item.match.some((prefix) => pathname.startsWith(prefix));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap ${active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
