import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-10" aria-busy aria-label="Chargement">
      <div className="space-y-3">
        <Skeleton className="h-10 w-3/4 max-w-xl" />
        <Skeleton className="h-10 w-1/2 max-w-sm" />
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-4 px-4 py-4">
                <Skeleton className="w-1 self-stretch rounded-full" />
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-7 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-32" />
          ))}
        </div>
      </div>
    </div>
  );
}
