"use client";

import { Pause } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { pauseAutopilot } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";

export function AutopilotBanner({ sentToday, canPause }: { sentToday: number; canPause: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
      <p>
        <span className="font-medium">Mode automatique.</span>{" "}
        <span className="text-muted-foreground">
          {sentToday === 0
            ? "Aucune relance n'est partie seule depuis 24 h."
            : `${sentToday} relance${sentToday > 1 ? "s sont parties" : " est partie"} seule${sentToday > 1 ? "s" : ""} depuis 24 h.`}
        </span>
      </p>
      {canPause && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await pauseAutopilot();
              toast.success("Tout passe à nouveau par vous");
            })
          }
        >
          <Pause /> Tout valider moi-même
        </Button>
      )}
    </div>
  );
}
