"use client";

import { Brain, FileText, Settings2, Sun, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  short?: string;
  icon: typeof Sun;
  match: string[];
  /** Owners and admins only. */
  managerOnly?: boolean;
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Aujourd'hui", icon: Sun, match: ["/dashboard", "/links"] },
  { href: "/equipe", label: "Équipe", icon: Users, match: ["/equipe"], managerOnly: true },
  { href: "/documents", label: "Documents", icon: FileText, match: ["/documents"] },
  {
    href: "/comment-ca-marche",
    label: "Comment ça marche",
    short: "Le pilote",
    icon: Brain,
    match: ["/comment-ca-marche"],
  },
  { href: "/settings", label: "Réglages", icon: Settings2, match: ["/settings"] },
];

const itemsFor = (isManager: boolean) => ITEMS.filter((item) => isManager || !item.managerOnly);

function useActive() {
  const pathname = usePathname();
  return (match: string[]) => match.some((prefix) => pathname.startsWith(prefix));
}

/** Pill tabs in the header, from the `sm` breakpoint up. */
export function DashboardNav({ isManager }: { isManager: boolean }) {
  const isActive = useActive();

  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-0.5 sm:flex">
      {itemsFor(isManager).map((item) => {
        const active = isActive(item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
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

/** Fixed tab bar at the bottom of the screen on phones. */
export function MobileNav({ isManager }: { isManager: boolean }) {
  const isActive = useActive();
  const items = itemsFor(isManager);

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className={cn("grid", items.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
        {items.map((item) => {
          const active = isActive(item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-micro outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {active && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-foreground" />}
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {item.short ?? item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
