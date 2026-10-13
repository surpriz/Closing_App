import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy aria-label="Chargement">
      <Skeleton className="h-4 w-72 max-w-full rounded-none" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-sm" />
          <Skeleton className="h-4 w-96 max-w-full rounded-sm" />
        </div>
        <Skeleton className="h-10 w-56 rounded-sm" />
      </div>
      <div className="divide-y divide-border border-y border-foreground bg-card">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="grid gap-x-4 gap-y-3 px-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-4">
            <div className="flex gap-px">
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton key={j} className="aspect-[3/4] w-7 rounded-none" />
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3 rounded-sm" />
              <Skeleton className="h-3 w-1/2 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
