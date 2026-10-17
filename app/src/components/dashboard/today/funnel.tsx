import { useTranslations } from "next-intl";

import type { Funnel, HeatDistribution } from "@/lib/closing/dashboard/funnel";
import { cn } from "@/lib/utils";

import { HEAT_BG } from "../heat";

// Words and hints are in "today.funnel", keyed like these
const STEPS: (keyof Funnel)[] = ["sent", "opened", "deep", "validated"];

function percent(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

/** What became of the links sent in the period. Ink only, no heat colour. */
export function FunnelStrip({ funnel }: { funnel: Funnel }) {
  const t = useTranslations("today.funnel");
  return (
    <ol className="grid grid-cols-2 overflow-hidden border-y border-foreground bg-card sm:grid-cols-4">
      {STEPS.map((step, index) => {
        const value = funnel[step];
        const share = percent(value, funnel.sent);
        return (
          <li
            key={step}
            title={t(`hints.${step}`)}
            className={cn(
              "flex flex-col gap-2.5 px-4 py-4",
              index > 0 && "sm:border-l sm:border-border",
              index % 2 === 1 && "border-l border-border",
              index > 1 && "border-t border-border sm:border-t-0",
            )}
          >
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-title font-medium tabular-nums">{value}</span>
              {index > 0 && funnel.sent > 0 && (
                <span className="text-micro text-muted-foreground tabular-nums">{share} %</span>
              )}
            </p>
            <span aria-hidden className="block h-1 overflow-hidden bg-foreground/[0.08]">
              <span
                className="block h-full bg-foreground/70"
                style={{ width: `${share}%` }}
              />
            </span>
            <span className="text-small text-muted-foreground">{t(`steps.${step}`, { count: value })}</span>
          </li>
        );
      })}
    </ol>
  );
}

const SEGMENTS: { key: keyof HeatDistribution; className: string }[] = [
  { key: "HOT", className: HEAT_BG.HOT },
  { key: "WARM", className: HEAT_BG.WARM },
  { key: "COLD", className: HEAT_BG.COLD },
  { key: "unopened", className: "bg-foreground/15" },
];

/** Open deals by temperature, right now. Colour always comes with a word. */
export function HeatDistributionBar({ distribution }: { distribution: HeatDistribution }) {
  const t = useTranslations("today.funnel");
  const parts = SEGMENTS.filter((segment) => distribution[segment.key] > 0);
  if (parts.length === 0) {
    return <p className="text-small text-muted-foreground">{t("noOpenDeals")}</p>;
  }

  const sentence = parts
    .map((segment) => `${distribution[segment.key]} ${t(`heat.${segment.key}`, { count: distribution[segment.key] })}`)
    .join(", ");

  return (
    <div className="space-y-3">
      <div role="img" aria-label={sentence} className="flex h-2.5 gap-0.5 overflow-hidden">
        {parts.map((segment) => (
          <span
            key={segment.key}
            className={cn("h-full", segment.className)}
            style={{ flexGrow: distribution[segment.key] }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small lg:block lg:space-y-1">
        {parts.map((segment) => {
          const count = distribution[segment.key];
          return (
            <li key={segment.key} className="flex items-center gap-2">
              <span className={cn("size-2", segment.className)} />
              <span className="tabular-nums">{count}</span>
              <span className="text-muted-foreground">{t(`heat.${segment.key}`, { count })}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
