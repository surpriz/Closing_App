"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { updateDealStatus } from "@/app/(dashboard)/links/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DealStatus } from "@/generated/prisma/enums";

const STATUSES: DealStatus[] = ["OPEN", "VALIDATED", "CHANGE_REQUESTED", "WON", "LOST"];

export function DealStatusSelect({ linkId, status }: { linkId: string; status: DealStatus }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.dealStatusSelect");
  const tl = useTranslations("labels");
  const ITEMS = STATUSES.map((value) => ({ value, label: tl(`dealStatus.${value}`) }));

  return (
    <Select
      items={ITEMS}
      value={optimistic}
      disabled={pending}
      onValueChange={(value) => {
        if (!value) return;
        const next = value as DealStatus;
        startTransition(async () => {
          setOptimistic(next);
          try {
            await updateDealStatus(linkId, next);
            toast.success(
              next === "OPEN"
                ? t("reopened")
                : t("changed", { status: tl(`dealStatus.${next}`) }),
            );
          } catch {
            toast.error(t("failed"));
          }
        });
      }}
    >
      <SelectTrigger aria-label={t("ariaLabel")} className="h-9 min-w-44 bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
