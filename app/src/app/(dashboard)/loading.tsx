import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  const t = useTranslations("common");
  return (
    <div className="space-y-10" aria-busy aria-label={t("loading")}>
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3 max-w-lg" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div>
        <div className="mb-3 border-b border-foreground pb-2">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="divide-y divide-border border-y border-foreground bg-card">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
