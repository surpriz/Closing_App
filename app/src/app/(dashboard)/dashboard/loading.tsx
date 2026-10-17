import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** The report's shape while it loads: header strip, headline, deal rows led by their thermal strip. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div className="space-y-10" aria-busy aria-label={t("loading")}>
      <div className="space-y-6">
        <div className="flex gap-6 border-b border-border pb-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-3/4 max-w-xl" />
          <Skeleton className="h-10 w-1/2 max-w-sm" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="mb-3 border-b border-foreground pb-2">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="divide-y divide-border border-y border-foreground bg-card">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-x-4 gap-y-3 px-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-4">
                <div className="flex gap-px">
                  {Array.from({ length: 4 }, (_, page) => (
                    <Skeleton key={page} className="aspect-[3/4] w-7 rounded-none" />
                  ))}
                </div>
                <div className="space-y-2.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="border-b border-foreground pb-2">
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-none" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-32" />
          ))}
        </div>
      </div>
    </div>
  );
}
