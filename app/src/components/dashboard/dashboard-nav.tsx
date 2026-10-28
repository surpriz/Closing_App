"use client";

import { ChartColumn, FileText, Send, Settings2, Sun, Telescope, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Item = {
  href: string;
  /** Key in "nav.dashboardNav". */
  label: "today" | "team" | "documents" | "results" | "prospecting" | "campaigns" | "settings";
  icon: typeof Sun;
  match: string[];
  /** Owners and admins only. */
  managerOnly?: boolean;
  /** Only once the workspace has a second member: alone, there is no team to look at. */
  teamOnly?: boolean;
  /** Prospecting POC workspaces only, and not in the phone tab bar (5 columns at most). */
  prospectingOnly?: boolean;
  /** Native cold email beta workspaces only, and not in the phone tab bar either. */
  campaignsOnly?: boolean;
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "today", icon: Sun, match: ["/dashboard", "/links"] },
  { href: "/team", label: "team", icon: Users, match: ["/team"], managerOnly: true, teamOnly: true },
  { href: "/documents", label: "documents", icon: FileText, match: ["/documents"] },
  { href: "/results", label: "results", icon: ChartColumn, match: ["/results"] },
  { href: "/prospecting", label: "prospecting", icon: Telescope, match: ["/prospecting"], prospectingOnly: true },
  { href: "/campaigns", label: "campaigns", icon: Send, match: ["/campaigns"], campaignsOnly: true },
  { href: "/settings", label: "settings", icon: Settings2, match: ["/settings"] },
];

type Access = { isManager: boolean; hasTeam: boolean; prospecting?: boolean; campaigns?: boolean };

const itemsFor = ({ isManager, hasTeam, prospecting, campaigns }: Access) =>
  ITEMS.filter(
    (item) => (isManager || !item.managerOnly) && (hasTeam || !item.teamOnly) && (prospecting || !item.prospectingOnly) &&
      (campaigns || !item.campaignsOnly),
  );

function useActive() {
  const pathname = usePathname();
  return (match: string[]) => match.some((prefix) => pathname.startsWith(prefix));
}

/** Report-strip tabs in the header, from the `sm` breakpoint up: cells between hairlines. */
export function DashboardNav(access: Access) {
  const isActive = useActive();
  const t = useTranslations("nav.dashboardNav");

  return (
    <nav aria-label={t("mainNav")} className="hidden items-stretch border-l border-border sm:flex">
      {itemsFor(access).map((item) => {
        const active = isActive(item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center border-r border-border px-4 text-small transition-colors duration-150 outline-none focus-visible:bg-muted",
              active
                ? "bg-card font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed tab bar at the bottom of the screen on phones. */
export function MobileNav({ isManager, hasTeam }: { isManager: boolean; hasTeam: boolean }) {
  const isActive = useActive();
  const t = useTranslations("nav.dashboardNav");
  const items = itemsFor({ isManager, hasTeam }).filter((item) => !item.prospectingOnly && !item.campaignsOnly);

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className={cn("grid", items.length === 5 ? "grid-cols-5" : items.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
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
              {active && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-foreground" />}
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {t(item.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
