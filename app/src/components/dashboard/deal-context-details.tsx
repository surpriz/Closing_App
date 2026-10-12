import { ChevronRight } from "lucide-react";

import { Surface } from "./page-header";

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
  return (
    <details className="group" open={paused}>
      <summary className="mb-3 flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1 outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1 text-body font-semibold">
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          Contexte du deal
        </span>
        <span className="text-body text-muted-foreground">
          {summary ?? "votre équipe le voit, pas le prospect"}
          {paused && " · en pause"}
        </span>
      </summary>
      <Surface>{children}</Surface>
    </details>
  );
}
