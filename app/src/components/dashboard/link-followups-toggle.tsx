"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleLinkFollowups } from "@/app/(dashboard)/followup-actions";
import { Switch } from "@/components/ui/switch";

export function LinkFollowupsToggle({
  linkId,
  enabled,
  campaign = null,
}: {
  linkId: string;
  enabled: boolean;
  /** While a campaign drives the link, its follow-ups are the campaign's to manage. */
  campaign?: { id: string; name: string } | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [, startTransition] = useTransition();
  const t = useTranslations("deal.linkFollowupsToggle");

  if (campaign) {
    const label = t("drivenByCampaign", { name: campaign.name });
    return (
      <span className="flex items-center gap-2">
        <Switch size="sm" checked={enabled} disabled aria-label={t("ariaLabel")} />
        <Link
          href={`/campaigns/${campaign.id}`}
          title={label}
          className="max-w-44 truncate text-micro text-muted-foreground hover:text-foreground hover:underline"
        >
          {label}
        </Link>
      </span>
    );
  }

  return (
    <Switch
      size="sm"
      checked={optimistic}
      aria-label={t("ariaLabel")}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          setOptimistic(checked);
          try {
            const result = await toggleLinkFollowups(linkId, checked);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(checked ? t("enabled") : t("disabled"));
          } catch {
            toast.error(t("failed"));
          }
        })
      }
    />
  );
}
