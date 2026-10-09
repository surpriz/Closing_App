"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { setProspectRole } from "@/app/(dashboard)/links/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProspectRole } from "@/generated/prisma/enums";

import { ROLE_LABELS } from "./labels";

const AUTO = "auto";

export function ProspectRoleSelect({
  linkId,
  prospectId,
  role,
  detected,
}: {
  linkId: string;
  prospectId: string;
  /** The seller's tag, null when the role is guessed. */
  role: ProspectRole | null;
  /** What the email suggests, shown on the "Auto" option. */
  detected: ProspectRole | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic<string>(role ?? AUTO);
  const [pending, startTransition] = useTransition();

  const items = [
    { value: AUTO, label: detected ? `Auto (${ROLE_LABELS[detected]})` : "Auto" },
    ...(Object.keys(ROLE_LABELS) as ProspectRole[]).map((value) => ({ value, label: ROLE_LABELS[value] })),
  ];

  return (
    <Select
      items={items}
      value={optimistic}
      disabled={pending}
      onValueChange={(value) => {
        if (!value) return;
        startTransition(async () => {
          setOptimistic(value);
          try {
            await setProspectRole(linkId, prospectId, value === AUTO ? null : (value as ProspectRole));
            toast.success("Rôle enregistré");
          } catch {
            toast.error("Modification impossible");
          }
        });
      }}
    >
      <SelectTrigger aria-label="Rôle du contact" size="sm" className="h-7 min-w-32 bg-card text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
