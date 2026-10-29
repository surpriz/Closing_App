import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div className="space-y-8" aria-busy aria-label={t("loading")}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-1/3 max-w-sm" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-border border-y border-foreground bg-card">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2 px-4 py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
