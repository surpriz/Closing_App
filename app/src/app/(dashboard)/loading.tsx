import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-10" aria-busy aria-label="Chargement">
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3 max-w-lg" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
