import type { EngagementTier } from "@/generated/prisma/enums";
import type { EngagementReason } from "@/lib/closing/types";

import { SCORE_REASON_LABELS, TIER_LABELS } from "./labels";

const TIER_STYLES: Record<EngagementTier, string> = {
  HOT: "bg-red-500/10 text-red-700 ring-red-500/20",
  WARM: "bg-amber-500/10 text-amber-700 ring-amber-500/20",
  COLD: "bg-slate-500/10 text-slate-600 ring-slate-500/20",
};

export function EngagementBadge({
  tier,
  score,
  reasons,
}: {
  tier: EngagementTier;
  score: number;
  reasons: unknown;
}) {
  const explanation = Array.isArray(reasons)
    ? (reasons as EngagementReason[])
        .map((r) => `${SCORE_REASON_LABELS[r.code] ?? r.code}${r.detail ? ` (${r.detail})` : ""} +${r.weight}`)
        .join("\n")
    : "";

  return (
    <span
      title={explanation || undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TIER_STYLES[tier]}`}
    >
      {TIER_LABELS[tier]} · {score}
    </span>
  );
}
