"use client";

import { FileText, Settings2, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

const ITEMS = [
  { href: "/dashboard", label: "Aujourd'hui", icon: Sun, match: ["/dashboard", "/links"] },
  { href: "/documents", label: "Devis", icon: FileText, match: ["/documents"] },
  { href: "/settings", label: "Réglages", icon: Settings2, match: ["/settings"] },
];

function useActive() {
  const pathname = usePathname();
  return (match: string[]) => match.some((prefix) => pathname.startsWith(prefix));
}

/** Pill tabs in the header, from the `sm` breakpoint up. */
export function DashboardNav() {
  const isActive = useActive();

  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-1 sm:flex">
      {ITEMS.map((item) => {
        const active = isActive(item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-foreground/[0.07] font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed tab bar at the bottom of the screen on phones. */
export function MobileNav() {
  const isActive = useActive();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="grid grid-cols-3">
        {ITEMS.map((item) => {
          const active = isActive(item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] outline-none focus-visible:bg-muted",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
