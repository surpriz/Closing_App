import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EngagementTier } from "@/generated/prisma/enums";
import { ENGAGEMENT_TIER_THRESHOLDS } from "@/lib/closing/constants";
import { cn } from "@/lib/utils";

import { HEAT_BG } from "./heat";

const { WARM, HOT } = ENGAGEMENT_TIER_THRESHOLDS;

const SEGMENTS: { tier: EngagementTier; from: number; to: number }[] = [
  { tier: "COLD", from: 0, to: WARM },
  { tier: "WARM", from: WARM, to: HOT },
  { tier: "HOT", from: HOT, to: 100 },
];

function nextStep(t: ReturnType<typeof useTranslations<"common.temperature">>, score: number) {
  if (score < WARM) return t("toWarm", { count: WARM - score });
  if (score < HOT) return t("toHot", { count: HOT - score });
  return t("intense");
}

/** Three-band scale with a marker at the score, and what the next band takes. */
export function TemperatureGauge({ tier, score }: { tier: EngagementTier; score: number }) {
  const t = useTranslations("common.temperature");
  const tl = useTranslations("labels");
  return (
    <div className="space-y-2">
      <div className="relative pt-1">
        <div className="flex h-2 gap-px">
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
          className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: `${Math.max(1, Math.min(99, score))}%` }}
        />
      </div>
      <div className="flex text-small text-muted-foreground">
        {SEGMENTS.map((segment) => (
          <span key={segment.tier} style={{ flexGrow: segment.to - segment.from }} className="basis-0">
            {tl(`tier.${segment.tier}`)}
          </span>
        ))}
      </div>
      <p className="text-small text-muted-foreground">{nextStep(t, score)}</p>
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
  const t = useTranslations("common.temperature");
  const rows: [string, string][] = [
    [t("rows.recentRead"), t("rows.recentReadRule")],
    [t("rows.readTime"), t("rows.readTimeRule")],
    [t("rows.visits"), t("rows.visitsRule")],
    [t("rows.readers"), t("rows.readersRule")],
    ...(hasPricing
      ? ([
          [
            t("rows.pricing"),
            t("rows.pricingRule", { third: Math.round(pricingThresholdSec / 3), full: pricingThresholdSec }),
          ],
        ] as [string, string][])
      : []),
    ...(hasPages ? ([[t("rows.progress"), t("rows.progressRule")]] as [string, string][]) : []),
    [t("rows.change"), t("rows.changeRule")],
    [t("rows.meeting"), t("rows.meetingRule")],
  ];

  return (
    <details className="group text-small">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted-foreground outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        {t("guideTitle")}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">{t("guideIntro", { warm: WARM, warmMax: HOT - 1, hot: HOT })}</p>
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
