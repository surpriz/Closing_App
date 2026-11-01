"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleLinkFollowups } from "@/app/(dashboard)/followup-actions";
import { Button } from "@/components/ui/button";

/**
 * The follow-up state of a link, in words, with the one action that changes it: a campaign's link
 * points at the campaign; a personal link reads "to approve" or "off" next to "turn off" / "turn on".
 */
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
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.linkFollowupsToggle");

  if (campaign) {
    const label = t("drivenByCampaign", { name: campaign.name });
    return (
      <Link
        href={`/campaigns/${campaign.id}`}
        title={label}
        className="max-w-56 truncate text-small text-muted-foreground hover:text-foreground hover:underline"
      >
        {label}
      </Link>
    );
  }

  const toggle = (checked: boolean) =>
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
    });

  return (
    <span className="flex items-center gap-1.5 text-small text-muted-foreground">
      <span>{optimistic ? t("stateOn") : t("stateOff")}</span>
      <Button size="xs" variant="ghost" disabled={pending} onClick={() => toggle(!optimistic)}>
        {optimistic ? t("turnOff") : t("turnOn")}
      </Button>
    </span>
  );
}
