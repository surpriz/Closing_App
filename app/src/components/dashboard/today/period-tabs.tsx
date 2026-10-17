import Link from "next/link";
import { useTranslations } from "next-intl";

import { PERIODS, type PeriodKey } from "@/lib/closing/dashboard/period";
import { cn } from "@/lib/utils";

/** Plain links: the period lives in the URL and survives live refreshes. */
export function PeriodTabs({ current }: { current: PeriodKey }) {
  const t = useTranslations("today.period");
  return (
    <nav aria-label={t("nav")} className="flex border border-border text-small">
      {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
        <Link
          key={key}
          href={`/dashboard?p=${key}`}
          scroll={false}
          aria-current={key === current ? "page" : undefined}
          className={cn(
            "border-r border-border px-2.5 py-0.5 text-muted-foreground last:border-r-0 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            key === current && "bg-foreground font-medium text-background hover:text-background",
          )}
        >
          {t(`${key}.label`)}
        </Link>
      ))}
    </nav>
  );
}
