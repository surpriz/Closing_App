import type { EngagementTier } from "@/generated/prisma/enums";
import type { EngagementReason } from "@/lib/closing/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "cn";

import { SCORE_REASON_LABELS, TIER_LABELS } from "./labels";

/** Temperature is the only colour in the interface. */
export const HEAT_BG: Record<EngagementTier, string> = {
  HOT: "bg-heat-hot",
  WARM: "bg-heat-warm",
  COLD: "bg-heat-cold",
};

export function scoreReasons(reasons: unknown) {
  if (!Array.isArray(reasons)) return [];
  return (reasons as EngagementReason[]).map((r) => ({
    label: `${SCORE_REASON_LABELS[r.code] ?? r.code}${r.detail ? ` (${r.detail})` : ""}`,
    weight: r.weight,
  }));
}

/**
 * Vertical gauge on the left edge of a prospect row. It fills from the bottom
 * up to the score, once, when the page loads.
 */
export function HeatBar({
  tier,
  score,
  className,
}: {
  tier: EngagementTier | null;
  score: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("relative block w-1 self-stretch overflow-hidden rounded-full bg-foreground/[0.06]", className)}
    >
      {tier && (
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 origin-bottom animate-heat-fill rounded-full motion-reduce:animate-none",
            HEAT_BG[tier],
          )}
          style={{ height: `${Math.max(12, Math.min(100, score))}%` }}
        />
      )}
    </span>
  );
}

/** Dot + word, with the score's reasons on hover or focus. */
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
  const lines = scoreReasons(reasons);
  const label = (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className={cn("size-2 rounded-full", HEAT_BG[tier])} />
      {TIER_LABELS[tier]}
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
