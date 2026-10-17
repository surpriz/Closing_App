import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * "Contexte du deal", folded: the summary line says what is filled in, the
 * form waits underneath. Open by default only while a pause is running.
 */
export function DealContextSummaryDetails({
  summary,
  paused,
  children,
}: {
  summary: string | null;
  paused: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("deal.dealContextDetails");
  return (
    <details className="group border-t border-foreground" open={paused}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1 py-2 outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5 text-heading">
          <ChevronRight
            className="size-4 self-center text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          />
          {t("title")}
        </span>
        <span className="text-small text-muted-foreground">
          {summary ?? t("emptySummary")}
          {paused && ` · ${t("paused")}`}
        </span>
      </summary>
      <div className="border-t border-border">{children}</div>
    </details>
  );
}
