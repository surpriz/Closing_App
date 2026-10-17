"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { setProspectRole } from "@/app/(dashboard)/links/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProspectRole } from "@/generated/prisma/enums";

const AUTO = "auto";
const ROLES: ProspectRole[] = ["DECISION_MAKER", "FINANCE", "TECHNICAL", "CHAMPION", "INFLUENCER", "OTHER"];

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
  const t = useTranslations("deal.prospectRoleSelect");
  const tl = useTranslations("labels");

  const items = [
    { value: AUTO, label: detected ? t("guessed", { role: tl(`prospectRole.${detected}`) }) : t("toSpecify") },
    ...ROLES.map((value) => ({ value, label: tl(`prospectRole.${value}`) })),
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
            toast.success(t("saved"));
          } catch {
            toast.error(t("failed"));
          }
        });
      }}
    >
      <SelectTrigger aria-label={t("ariaLabel")} size="sm" className="h-7 min-w-32 bg-card text-small">
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
