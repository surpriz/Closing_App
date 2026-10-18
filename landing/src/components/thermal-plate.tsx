/**
 * One page of a quote seen through a thermal camera. `heat` (0–1) is how long it was read,
 * relative to the most-read page; ironbow layers fade in as it rises.
 * Geometry only: the page skeleton is drawn as bars, the heat as radial fields.
 */
export function ThermalPlate({
  heat,
  seed = 0,
  className = "",
  heading,
  children,
}: {
  heat: number;
  seed?: number;
  className?: string;
  /** The page's real title, drawn in place of the title bar. Decorative: the caption carries it. */
  heading?: string;
  children?: React.ReactNode;
}) {
  // Where the reader lingered on this page: varies per page so the band never looks stamped.
  const y = [34, 58, 46, 44, 62, 40][seed % 6];
  const x = [48, 40, 56, 50, 44, 52][seed % 6];
  const at = `at ${x}% ${y}%`;
  const layer = (from: number, to: number) => Math.min(1, Math.max(0, (heat - from) / (to - from)));

  return (
    <div className={`@container relative overflow-hidden bg-iron-0 ${className}`}>
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.02, 0.4), background: `radial-gradient(75% 55% ${at}, var(--color-iron-1), transparent 75%)` }}
      />
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.35, 0.75), background: `radial-gradient(52% 38% ${at}, var(--color-iron-2), transparent 72%)` }}
      />
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.7, 0.92), background: `radial-gradient(34% 24% ${at}, var(--color-iron-3), transparent 70%)` }}
      />
      <div
        className="plate-layer absolute inset-0"
        style={{ opacity: layer(0.9, 1), background: `radial-gradient(16% 11% ${at}, var(--color-iron-4), transparent 70%)` }}
      />
      {/* The page itself: title, paragraphs, a table, as the camera sees paper. */}
      <div aria-hidden className="absolute inset-x-[14%] top-[12%] grid gap-[6%] opacity-25 mix-blend-screen">
        {heading ? (
          <span className="text-[9cqw] leading-tight font-semibold text-sheet">{heading}</span>
        ) : (
          <span className="h-1.5 w-2/3 bg-sheet" />
        )}
        <span className="grid gap-1.5">
          <span className="h-1 bg-sheet" />
          <span className="h-1 bg-sheet" />
          <span className="h-1 w-4/5 bg-sheet" />
        </span>
        <span className="grid gap-1.5">
          <span className="h-1 bg-sheet" />
          <span className="h-1 w-3/5 bg-sheet" />
        </span>
        <span className="grid grid-cols-3 gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="h-2.5 bg-sheet/70" />
          ))}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Calibrated scale: the legend every thermal image carries. */
export function HeatScale({ orientation = "vertical", className = "" }: { orientation?: "vertical" | "horizontal"; className?: string }) {
  const vertical = orientation === "vertical";
  return (
    <div className={`flex ${vertical ? "flex-col" : "flex-row-reverse"} gap-2 ${className}`}>
      <div
        className={vertical ? "w-3 flex-1" : "h-3 flex-1"}
        style={{
          background: `linear-gradient(${vertical ? "to bottom" : "to left"}, var(--color-iron-4), var(--color-iron-3) 18%, var(--color-iron-2) 42%, var(--color-iron-1) 70%, var(--color-iron-0))`,
        }}
        aria-hidden
      />
    </div>
  );
}
