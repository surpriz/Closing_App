import { cn } from "@/lib/utils";

/**
 * One page of a document seen through a thermal camera. `heat` (0–1) is how long it was read,
 * relative to the most-read page; ironbow layers fade in as it rises. Same drawing as the landing.
 */
export function ThermalPlate({
  heat,
  seed = 0,
  skeleton = true,
  className,
  children,
}: {
  heat: number;
  seed?: number;
  skeleton?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  // Where the reader lingered on this page: varies per page so a band never looks stamped.
  const y = [34, 58, 46, 44, 62, 40][seed % 6];
  const x = [48, 40, 56, 50, 44, 52][seed % 6];
  const at = `at ${x}% ${y}%`;
  const layer = (from: number, to: number) => Math.min(1, Math.max(0, (heat - from) / (to - from)));

  return (
    <div className={cn("relative overflow-hidden bg-iron-0", className)}>
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.02, 0.4), background: `radial-gradient(75% 55% ${at}, var(--iron-1), transparent 75%)` }}
      />
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.35, 0.75), background: `radial-gradient(52% 38% ${at}, var(--iron-2), transparent 72%)` }}
      />
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.7, 0.92), background: `radial-gradient(34% 24% ${at}, var(--iron-3), transparent 70%)` }}
      />
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.9, 1), background: `radial-gradient(16% 11% ${at}, var(--iron-4), transparent 70%)` }}
      />
      {skeleton && (
        <div aria-hidden className="absolute inset-x-[14%] top-[12%] grid gap-[8%] opacity-25 mix-blend-screen">
          <span className="h-[3px] w-2/3 bg-white" />
          <span className="grid gap-[3px]">
            <span className="h-[2px] bg-white" />
            <span className="h-[2px] bg-white" />
            <span className="h-[2px] w-4/5 bg-white" />
          </span>
          <span className="grid gap-[3px]">
            <span className="h-[2px] bg-white" />
            <span className="h-[2px] w-3/5 bg-white" />
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

/** Calibrated scale: the legend every thermal image carries. */
export function HeatScale({ orientation = "horizontal", className }: { orientation?: "vertical" | "horizontal"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block", orientation === "vertical" ? "w-2.5" : "h-2.5", className)}
      style={{
        background: `linear-gradient(${orientation === "vertical" ? "to bottom" : "to right"}, var(--iron-0), var(--iron-1) 30%, var(--iron-2) 58%, var(--iron-3) 82%, var(--iron-4))`,
      }}
    />
  );
}
