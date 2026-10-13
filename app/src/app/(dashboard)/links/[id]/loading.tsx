import { Skeleton } from "@/components/ui/skeleton";

/** The report's frame while the reading loads: strip, name, next action, the band of pages. */
export default function Loading() {
  return (
    <div className="space-y-10" aria-busy aria-label="Chargement">
      <div className="space-y-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full max-w-md" />
        <Skeleton className="h-12 w-72 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex items-center justify-between gap-6 border-y border-foreground py-4">
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-10 w-36 shrink-0" />
      </div>
      <div className="space-y-4">
        <div className="border-b border-foreground pb-2">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid max-w-[48rem] grid-cols-6 gap-px">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-none" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3 border-t border-foreground pt-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-3 border-t border-foreground pt-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16" />
        </div>
      </div>
    </div>
  );
}
