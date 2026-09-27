"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { updateDealStatus } from "@/app/(dashboard)/links/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DealStatus } from "@/generated/prisma/enums";

import { DEAL_STATUS_LABELS } from "./labels";

const ITEMS = (Object.keys(DEAL_STATUS_LABELS) as DealStatus[]).map((value) => ({
  value,
  label: DEAL_STATUS_LABELS[value],
}));

export function DealStatusSelect({ linkId, status }: { linkId: string; status: DealStatus }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

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
                ? "Deal rouvert"
                : `Statut « ${DEAL_STATUS_LABELS[next]} », relances en attente annulées`,
            );
          } catch {
            toast.error("Modification impossible");
          }
        });
      }}
    >
      <SelectTrigger aria-label="Statut du deal" className="h-9 min-w-44 bg-card">
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
