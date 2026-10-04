"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { reanalyzeDeal } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReanalyzeButton({ linkId, label = "Réanalyser" }: { linkId: string; label?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reanalyzeDeal(linkId);
          if (result.error) toast.error(result.error);
          else toast.success("Analyse à jour");
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} /> {pending ? "Analyse…" : label}
    </Button>
  );
}
