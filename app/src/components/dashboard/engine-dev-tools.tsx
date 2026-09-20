"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { runEngineNow, simulateLinkSentDaysAgo } from "@/app/(dashboard)/followup-actions";
import { Button } from "@/components/ui/button";

// Rendered in local development only
export function EngineDevTools({ links }: { links: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [linkId, setLinkId] = useState(links[0]?.id ?? "");

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3 text-sm">
      <p className="font-medium">Outils de test (local uniquement)</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await runEngineNow();
              toast.success(
                `Cycle terminé : ${result.antiGhostingQueued} anti-ghosting créée(s), ${result.dispatched.sent} envoyée(s), ${result.dispatched.failed} échec(s), ${result.dispatched.cancelled} annulée(s)`,
              );
            })
          }
        >
          Lancer un cycle du moteur
        </Button>
        <span className="text-xs text-muted-foreground">envoie les relances arrivées à échéance</span>
      </div>
      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            className="h-7 rounded-md border bg-background px-2 text-sm"
          >
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                {link.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !linkId}
            onClick={() =>
              startTransition(async () => {
                await simulateLinkSentDaysAgo(linkId, 4);
                toast.success("Lien marqué comme envoyé il y a 4 jours. Lancez un cycle.");
              })
            }
          >
            Simuler un envoi il y a 4 jours
          </Button>
          <span className="text-xs text-muted-foreground">l&apos;anti-ghosting ne vise que les liens jamais ouverts</span>
        </div>
      )}
    </div>
  );
}
