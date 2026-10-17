import { useLocale, useTranslations } from "next-intl";

import type { EngagementTier } from "@/generated/prisma/enums";
import { formatReadTime } from "@/lib/closing/dashboard/document-heat";
import type { PageHeat } from "@/lib/closing/dashboard/page-heat";
import { segmentLabel } from "@/lib/closing/documents/video-segments";
import { cn } from "@/lib/utils";

const TIER_SWATCH: Record<EngagementTier, string> = {
  HOT: "bg-heat-hot",
  WARM: "bg-heat-warm",
  COLD: "bg-heat-cold",
};

/** Mono report fields under a hairline: the first one in ink, the rest in soft ink. */
export function ReportStrip({ fields, className }: { fields: React.ReactNode[]; className?: string }) {
  return (
    <p
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-1 border-b border-border pb-2 font-mono text-micro text-muted-foreground",
        className,
      )}
    >
      {fields.filter(Boolean).map((field, index) => (
        <span key={index} className={index === 0 ? "text-foreground" : undefined}>
          {field}
        </span>
      ))}
    </p>
  );
}

/**
 * The reading state as a square swatch beside its word. `tier` paints the swatch only when
 * the state is a temperature; a signed deal is green, anything else neutral.
 */
export function StateMark({
  state,
  tier,
  signed = false,
  strong = false,
  className,
}: {
  state: string;
  tier: EngagementTier | null;
  signed?: boolean;
  /** Ink instead of soft ink: there is something to read off. */
  strong?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden
        className={cn("size-2 shrink-0", signed ? "bg-success" : tier ? TIER_SWATCH[tier] : "bg-foreground/25")}
      />
      <span className={cn(strong && "font-medium text-foreground")}>{state}</span>
    </span>
  );
}

/** "Page 4 la plus lue · 3 min 38", the reading the strip's reticle points at. */
export function HottestReading({
  heat,
  video = false,
  className,
}: {
  heat: PageHeat | null;
  video?: boolean;
  className?: string;
}) {
  const t = useTranslations("documents.readingBits");
  const locale = useLocale();
  if (!heat?.hottest) return null;
  const { page, seconds } = heat.hottest;
  return (
    <span className={cn("text-foreground", className)}>
      {video ? t("hottestSegment", { segment: segmentLabel(page, undefined, locale) }) : t("hottestPage", { page })} ·{" "}
      <span className="font-medium">{formatReadTime(seconds)}</span>
    </span>
  );
}
