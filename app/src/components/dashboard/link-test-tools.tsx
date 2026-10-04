"use client";

import { FlaskConical } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { runEngineNow, timeTravelLink } from "@/app/(dashboard)/followup-actions";
import { Button } from "@/components/ui/button";

// Rendered when test tools are on (local dev, staging), never in production
export function LinkTestTools({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();

  const travel = (days: number) =>
    startTransition(async () => {
      await timeTravelLink(linkId, days);
      toast.success(`Ce deal a vieilli de ${days} jour${days > 1 ? "s" : ""}. Lancez un cycle du moteur pour voir la suite.`);
    });

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <FlaskConical className="size-4" /> Outils de test (absents en production)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Faire passer le temps :</span>
        {[1, 3, 7].map((days) => (
          <Button key={days} size="sm" variant="outline" disabled={pending} onClick={() => travel(days)}>
            +{days} j
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await runEngineNow();
              toast.success(
                `Cycle : ${r.antiGhostingQueued} rappel(s) créé(s), ${r.dispatched.sent} envoyée(s), ${r.dealsAnalyzed} analyse(s), ${r.documentsRead} document(s) lu(s)`,
              );
            })
          }
        >
          Lancer un cycle du moteur
        </Button>
        <span className="text-muted-foreground">
          rappels « pas ouvert », envois à l&apos;heure prévue, analyses en retard
        </span>
      </div>
    </div>
  );
}
