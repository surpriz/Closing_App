"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleLinkFollowups } from "@/app/(dashboard)/followup-actions";
import { Switch } from "@/components/ui/switch";

export function LinkFollowupsToggle({ linkId, enabled }: { linkId: string; enabled: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [, startTransition] = useTransition();

  return (
    <Switch
      size="sm"
      checked={optimistic}
      aria-label="Relances automatiques"
      onCheckedChange={(checked) =>
        startTransition(async () => {
          setOptimistic(checked);
          try {
            const result = await toggleLinkFollowups(linkId, checked);
            if (result?.error) return void toast.error(result.error);
            toast.success(checked ? "Relances activées" : "Relances désactivées, relances en attente annulées");
          } catch {
            toast.error("Modification impossible");
          }
        })
      }
    />
  );
}
