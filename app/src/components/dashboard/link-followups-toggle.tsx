"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleLinkFollowups } from "@/app/(dashboard)/followup-actions";
import { Switch } from "@/components/ui/switch";

export function LinkFollowupsToggle({ linkId, enabled }: { linkId: string; enabled: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [, startTransition] = useTransition();
  const t = useTranslations("deal.linkFollowupsToggle");

  return (
    <Switch
      size="sm"
      checked={optimistic}
      aria-label={t("ariaLabel")}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          setOptimistic(checked);
          try {
            await toggleLinkFollowups(linkId, checked);
            toast.success(checked ? t("enabled") : t("disabled"));
          } catch {
            toast.error(t("failed"));
          }
        })
      }
    />
  );
}
