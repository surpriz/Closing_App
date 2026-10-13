import { ThermalPlate } from "@/components/brand/thermal-plate";
import type { PageHeat } from "@/lib/closing/dashboard/page-heat";
import { cn } from "@/lib/utils";

/** Pages of the document as thermal plates, the reticle on the most-read one. */
export function HeatStrip({ heat, className }: { heat: PageHeat | null; className?: string }) {
  if (!heat) {
    return (
      <span aria-hidden className={cn("flex h-fit w-full max-w-[7.25rem] gap-px", className)}>
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="aspect-[3/4] max-w-[1.75rem] min-w-0 flex-1 bg-muted" />
        ))}
      </span>
    );
  }
  return (
    <span aria-hidden className={cn("flex h-fit w-full max-w-[7.25rem] gap-px", className)}>
      {heat.heats.map((value, i) => (
        // Plates share the strip's width, never wider than a report thumbnail
        <ThermalPlate
          key={i}
          heat={value}
          seed={i}
          skeleton={false}
          className="aspect-[3/4] max-w-[1.75rem] min-w-0 flex-1"
        >
          {heat.hottest?.plate === i && <span className="absolute inset-[18%] border border-white" />}
        </ThermalPlate>
      ))}
    </span>
  );
}
