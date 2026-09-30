import { ChevronRight } from "lucide-react";

import type { EngagementTier } from "@/generated/prisma/enums";
import { ENGAGEMENT_TIER_THRESHOLDS } from "@/lib/closing/constants";
import { cn } from "cn";

import { HEAT_BG } from "./heat";
import { TIER_LABELS } from "./labels";

const { WARM, HOT } = ENGAGEMENT_TIER_THRESHOLDS;

const SEGMENTS: { tier: EngagementTier; from: number; to: number }[] = [
  { tier: "COLD", from: 0, to: WARM },
  { tier: "WARM", from: WARM, to: HOT },
  { tier: "HOT", from: HOT, to: 100 },
];

function nextStep(score: number) {
  if (score < WARM) return `Encore ${WARM - score} point${WARM - score > 1 ? "s" : ""} pour passer tiède.`;
  if (score < HOT) return `Encore ${HOT - score} point${HOT - score > 1 ? "s" : ""} pour passer chaud.`;
  return "Le prospect est chaud : c'est le moment de le relancer.";
}

/** Three-band scale with a marker at the score, and what the next band takes. */
export function TemperatureGauge({ tier, score }: { tier: EngagementTier; score: number }) {
  return (
    <div className="space-y-2">
      <div className="relative pt-1">
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {SEGMENTS.map((segment) => (
            <span
              key={segment.tier}
              style={{ flexGrow: segment.to - segment.from }}
              className={cn(HEAT_BG[segment.tier], segment.tier !== tier && "opacity-25")}
            />
          ))}
        </div>
        <span
          aria-hidden
          className="absolute top-0 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${Math.max(1, Math.min(99, score))}%` }}
        />
      </div>
      <div className="flex text-xs text-muted-foreground tabular-nums">
        {SEGMENTS.map((segment) => (
          <span key={segment.tier} style={{ flexGrow: segment.to - segment.from }} className="basis-0">
            {TIER_LABELS[segment.tier]}
          </span>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{nextStep(score)}</p>
    </div>
  );
}

/**
 * How the score is built, in plain words. Mirrors
 * `lib/closing/engagement/scoring.ts`: change both together.
 */
export function ScoreGuide({
  hasPages,
  hasPricing,
  pricingThresholdSec,
}: {
  hasPages: boolean;
  hasPricing: boolean;
  pricingThresholdSec: number;
}) {
  const rows: [string, string][] = [
    ["Lecture récente", "25 si lu dans les dernières 24 h, 15 sur 3 jours, 5 sur 7 jours"],
    ["Temps de lecture", "1 point toutes les 12 secondes, jusqu'à 25"],
    ["Visites", "5 pour la première, 12 pour la deuxième, 20 à partir de trois"],
    ["Plusieurs lecteurs", "10 à deux personnes, 15 à partir de trois : le document circule"],
    ...(hasPricing
      ? ([
          [
            "Page de tarifs",
            `7 à partir de ${Math.round(pricingThresholdSec / 3)} s dessus, 15 à partir de ${pricingThresholdSec} s`,
          ],
        ] as [string, string][])
      : []),
    ...(hasPages ? ([["Progression", "4 si lu à moitié, 10 si lu jusqu'au bout"]] as [string, string][]) : []),
    ["Ajustement demandé", "10 points"],
  ];

  return (
    <details className="group mt-4 text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted-foreground outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        Comment la température est calculée
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">
          Un score sur 100 qui mesure l&apos;intérêt du prospect pour ce document. Froid en dessous de {WARM}, tiède
          jusqu&apos;à {HOT - 1}, chaud à partir de {HOT}. Il baisse tout seul si le prospect ne revient pas, et
          passe à 100 quand la proposition est validée ou le deal gagné.
        </p>
        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
          {rows.map(([label, rule]) => (
            <div key={label} className="contents">
              <dt className="font-medium">{label}</dt>
              <dd className="text-muted-foreground">{rule}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
