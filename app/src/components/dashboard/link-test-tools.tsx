"use client";

import { ChevronRight, FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { runEngineNow, timeTravelLink } from "@/app/(dashboard)/followup-actions";
import { Button } from "@/components/ui/button";

// Rendered when test tools are on (local dev, staging), never in production
export function LinkTestTools({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.linkTestTools");

  const travel = (days: number) =>
    startTransition(async () => {
      await timeTravelLink(linkId, days);
      toast.success(t("aged", { days }));
    });

  return (
    <details className="group text-small text-muted-foreground">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 outline-none hover:text-foreground focus-visible:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        <FlaskConical className="size-3.5" /> {t("title")}
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{t("timeTravel")}</span>
        {[1, 3, 7].map((days) => (
          <Button key={days} size="sm" variant="outline" disabled={pending} onClick={() => travel(days)}>
            {t("plusDays", { days })}
          </Button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await runEngineNow();
              toast.success(
                t("cycleResult", {
                  queued: r.antiGhostingQueued,
                  sent: r.dispatched.sent,
                  analyzed: r.dealsAnalyzed,
                  read: r.documentsRead,
                }),
              );
            })
          }
        >
          {t("runCycle")}
        </Button>
        <span className="text-muted-foreground">
          {t("cycleHint")}
        </span>
      </div>
    </details>
  );
}
