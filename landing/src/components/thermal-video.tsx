import { HeatScale } from "./thermal-plate";

// One example viewing of a 3 minute pitch, tracked like the app does: ten slices of 10%.
// "skipped": jumped over, which the app doesn't count; null: past where the prospect stopped.
// The pricing slice was watched twice.
const SLICES = [0.5, 0.45, "skipped", 0.4, 0.55, 0.7, 1, null, null, null] as const;
const HOTTEST = SLICES.indexOf(1);
const HATCH = "repeating-linear-gradient(135deg, var(--color-iron-1) 0 2px, transparent 2px 7px)";

function sliceColor(heat: number) {
  if (heat >= 0.9) return "var(--color-iron-3)";
  if (heat >= 0.6) return "var(--color-iron-2)";
  return "var(--color-iron-1)";
}

/**
 * The video section's figure: the pitch seen through the thermal camera (the seller as a heat
 * silhouette), then the strip of tenths underneath. Decorative; the caption carries the reading.
 */
export function ThermalVideo({
  name,
  caption,
  summary,
  labels,
}: {
  name: string;
  caption: string;
  summary: string;
  labels: { example: string; skipped: string; hottest: string; quote: string; hot: string; cold: string };
}) {
  return (
    <figure className="border border-ink bg-sheet">
      <figcaption className="sr-only">{caption}</figcaption>
      <div aria-hidden>
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink px-4 py-2.5 text-small">
          <span className="font-mono text-micro">{name}</span>
          <span className="shrink-0 text-micro text-ink-soft">{labels.example}</span>
        </p>
        <div className="relative aspect-video overflow-hidden bg-iron-0">
          {/* Shoulders, then the head: warmest at the face, as a thermal camera sees someone talking. */}
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(46% 34% at 50% 100%, var(--color-iron-2), var(--color-iron-1) 55%, transparent 80%)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(13% 21% at 50% 44%, var(--color-iron-4), var(--color-iron-3) 35%, var(--color-iron-2) 62%, var(--color-iron-1) 82%, transparent 100%)",
            }}
          />
          <span className="absolute top-3 left-3 bg-ink/70 px-2 py-1 font-mono text-micro text-sheet">1:58 / 3:00</span>
          <span className="absolute right-3 bottom-3 bg-sheet px-3 py-1.5 text-micro font-semibold text-ink">{labels.quote}</span>
        </div>
        <div className="grid grid-cols-10 gap-px border-y border-ink bg-ink">
          {SLICES.map((heat, i) => (
            <div key={i} className="relative h-14 bg-iron-0 sm:h-16">
              {heat === "skipped" && <div className="absolute inset-0 opacity-70" style={{ background: HATCH }} />}
              {typeof heat === "number" && (
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to top, ${sliceColor(heat)}, var(--color-iron-0) ${Math.round(110 - heat * 40)}%)` }}
                />
              )}
              {i === HOTTEST && (
                <span className="absolute inset-x-[18%] top-1/2 aspect-square -translate-y-1/2 border-2 border-sheet" />
              )}
            </div>
          ))}
        </div>
        <p className="flex justify-between px-2 pt-1.5 font-mono text-micro text-ink-soft">
          <span>0:00</span>
          <span>3:00</span>
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 pt-3 text-micro text-ink-soft">
          <span className="flex items-center gap-2">
            <span className="size-3 bg-iron-0" style={{ backgroundImage: HATCH }} />
            {labels.skipped}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 border-2 border-ink" />
            {labels.hottest}
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <p className="text-small font-medium">{summary}</p>
          <p className="flex min-w-40 flex-1 items-center gap-3 font-mono text-micro text-ink-soft sm:max-w-56">
            <span>{labels.cold}</span>
            <HeatScale orientation="horizontal" className="flex-1" />
            <span>{labels.hot}</span>
          </p>
        </div>
      </div>
    </figure>
  );
}
