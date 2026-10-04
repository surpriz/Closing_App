import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy aria-label="Chargement">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
      <div className="flex gap-6 border-b border-border pb-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
      <div className="space-y-px overflow-hidden rounded-xl ring-1 ring-border">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-18 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
