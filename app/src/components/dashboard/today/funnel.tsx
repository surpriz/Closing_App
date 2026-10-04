import type { Funnel, HeatDistribution } from "@/lib/closing/dashboard/funnel";
import { cn } from "@/lib/utils";

import { HEAT_BG } from "../heat";

type Words = [one: string, many: string];

function counted(count: number, [one, many]: Words) {
  return count === 1 ? one : many;
}

const STEPS: { key: keyof Funnel; words: Words }[] = [
  { key: "sent", words: ["envoyé", "envoyés"] },
  { key: "opened", words: ["ouvert", "ouverts"] },
  { key: "deep", words: ["lu en profondeur", "lus en profondeur"] },
  { key: "validated", words: ["validé", "validés"] },
];

const STEP_HINTS: Record<keyof Funnel, string> = {
  sent: "Liens créés sur la période.",
  opened: "Au moins une lecture, hors robots.",
  deep: "La moitié du PDF avec au moins 30 s de lecture, une minute sur un lien web, ou une longue lecture des tarifs.",
  validated: "« Valider & signer » cliqué, ou deal marqué validé ou gagné.",
};

function percent(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

/** What became of the links sent in the period. Ink only, no heat colour. */
export function FunnelStrip({ funnel }: { funnel: Funnel }) {
  return (
    <ol className="grid grid-cols-2 overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border sm:grid-cols-4">
      {STEPS.map((step, index) => {
        const value = funnel[step.key];
        const share = percent(value, funnel.sent);
        return (
          <li
            key={step.key}
            title={STEP_HINTS[step.key]}
            className={cn(
              "flex flex-col gap-2.5 px-4 py-4",
              index > 0 && "sm:border-l sm:border-border",
              index % 2 === 1 && "border-l border-border",
              index > 1 && "border-t border-border sm:border-t-0",
            )}
          >
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-medium tracking-tight tabular-nums">{value}</span>
              {index > 0 && funnel.sent > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{share} %</span>
              )}
            </p>
            <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
              <span
                className="block h-full rounded-full bg-foreground/70"
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="text-sm text-muted-foreground">{counted(value, step.words)}</span>
          </li>
        );
      })}
    </ol>
  );
}

const SEGMENTS: { key: keyof HeatDistribution; className: string; words: Words }[] = [
  { key: "HOT", className: HEAT_BG.HOT, words: ["chaud", "chauds"] },
  { key: "WARM", className: HEAT_BG.WARM, words: ["tiède", "tièdes"] },
  { key: "COLD", className: HEAT_BG.COLD, words: ["froid", "froids"] },
  { key: "unopened", className: "bg-foreground/15", words: ["pas encore ouvert", "pas encore ouverts"] },
];

/** Open deals by temperature, right now. Colour always comes with a word. */
export function HeatDistributionBar({ distribution }: { distribution: HeatDistribution }) {
  const parts = SEGMENTS.filter((segment) => distribution[segment.key] > 0);
  if (parts.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun deal en cours.</p>;
  }

  const sentence = parts
    .map((segment) => `${distribution[segment.key]} ${counted(distribution[segment.key], segment.words)}`)
    .join(", ");

  return (
    <div className="space-y-3">
      <div role="img" aria-label={sentence} className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map((segment) => (
          <span
            key={segment.key}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", segment.className)}
            style={{ flexGrow: distribution[segment.key] }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm lg:block lg:space-y-1">
        {SEGMENTS.map((segment) => {
          const count = distribution[segment.key];
          return (
            <li key={segment.key} className={cn("flex items-center gap-2", count === 0 && "text-muted-foreground")}>
              <span className={cn("size-2 rounded-full", segment.className)} />
              <span className="tabular-nums">{count}</span>
              <span className="text-muted-foreground">{counted(count, segment.words)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
