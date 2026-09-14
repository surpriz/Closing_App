"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { updateDealStatus } from "@/app/(dashboard)/links/actions";
import type { DealStatus } from "@/generated/prisma/enums";

import { DEAL_STATUS_LABELS } from "./labels";

const STATUSES = Object.keys(DEAL_STATUS_LABELS) as DealStatus[];

export function DealStatusSelect({ linkId, status }: { linkId: string; status: DealStatus }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Statut du deal"
      value={optimistic}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as DealStatus;
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
      className="h-8 rounded-lg border bg-background px-2 text-sm"
    >
      {STATUSES.map((value) => (
        <option key={value} value={value}>
          {DEAL_STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
