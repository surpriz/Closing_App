import { useTranslations } from "next-intl";

import type { EngagementTier } from "@/generated/prisma/enums";
import type { EngagementReason } from "@/lib/closing/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { LabelsT } from "./labels";

/** Temperature is the only colour in the interface: three readings of the ironbow scale. */
export const HEAT_BG: Record<EngagementTier, string> = {
  HOT: "bg-heat-hot",
  WARM: "bg-heat-warm",
  COLD: "bg-heat-cold",
};

export function scoreReasons(tl: LabelsT, reasons: unknown) {
  if (!Array.isArray(reasons)) return [];
  return (reasons as EngagementReason[]).map((r) => ({
    label: `${tl.has(`scoreReason.${r.code}` as never) ? tl(`scoreReason.${r.code}` as never) : r.code}${r.detail ? ` (${r.detail})` : ""}`,
    weight: r.weight,
  }));
}

const fill = (score: number) => Math.max(12, Math.min(100, score));

/**
 * Horizontal thermal gauge: the ironbow scale uncovered from the left up to the score.
 * Use where per-page readings are not at hand; prefer HeatStrip (heat-strip.tsx) when they are.
 */
export function HeatGauge({ tier, score, className }: { tier: EngagementTier | null; score: number; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block h-1.5 w-full overflow-hidden bg-foreground/[0.07]", className)}>
      {tier && (
        <span
          className="absolute inset-y-0 left-0"
          style={{
            width: `${fill(score)}%`,
            backgroundImage:
              "linear-gradient(to right, var(--iron-0), var(--iron-1) 30%, var(--iron-2) 58%, var(--iron-3) 82%, var(--iron-4))",
            backgroundSize: `${(100 / fill(score)) * 100}% 100%`,
            backgroundPosition: "left",
          }}
        />
      )}
    </span>
  );
}

/** Swatch + word, with the score's reasons on hover or focus. */
export function HeatDot({
  tier,
  score,
  reasons,
  className,
}: {
  tier: EngagementTier;
  score: number;
  reasons?: unknown;
  className?: string;
}) {
  const tl = useTranslations("labels");
  const lines = scoreReasons(tl, reasons);
  const label = (
    <span className={cn("inline-flex items-center gap-1.5 text-small", className)}>
      <span className={cn("size-2", HEAT_BG[tier])} />
      {tl(`tier.${tier}`)}
      <span className="text-muted-foreground tabular-nums">{score}</span>
    </span>
  );

  if (lines.length === 0) return label;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} />}
        className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="block space-y-0.5 py-2">
        {lines.map((line) => (
          <span key={line.label} className="flex justify-between gap-4">
            <span>{line.label}</span>
            <span className="tabular-nums opacity-70">+{line.weight}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/** The temperature as a small tag: swatch + word, "Pas encore lu" without a score. */
export function HeatPill({ tier, className }: { tier: EngagementTier | null; className?: string }) {
  const tl = useTranslations("labels");
  const t = useTranslations("deal.heat");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm bg-muted px-2 py-0.5 text-small font-medium",
        className,
      )}
    >
      <span className={cn("size-2", tier ? HEAT_BG[tier] : "bg-foreground/20")} aria-hidden />
      {tier ? tl(`tier.${tier}`) : t("notRead")}
    </span>
  );
}

/** Pulsing hot dot: someone is reading right now. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2.5", className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-heat-hot opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2.5 rounded-full bg-heat-hot" />
    </span>
  );
}
