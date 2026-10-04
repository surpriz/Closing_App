import Link from "next/link";

import { PERIODS, type PeriodKey } from "@/lib/closing/dashboard/period";
import { cn } from "cn";

/** Plain links: the period lives in the URL and survives live refreshes. */
export function PeriodTabs({ current }: { current: PeriodKey }) {
  return (
    <nav aria-label="Période" className="flex gap-0.5 rounded-full bg-foreground/[0.04] p-0.5 text-[13px]">
      {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
        <Link
          key={key}
          href={`/dashboard?p=${key}`}
          scroll={false}
          aria-current={key === current ? "page" : undefined}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            key === current && "bg-card font-medium text-foreground shadow-xs ring-1 ring-border",
          )}
        >
          {PERIODS[key].label}
        </Link>
      ))}
    </nav>
  );
}
