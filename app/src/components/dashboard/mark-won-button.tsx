"use client";

import { Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateDealStatus } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";

/** The prospect signed: one click records the sale and stops every follow-up. */
export function MarkWonButton({ linkId, size = "sm" }: { linkId: string; size?: "sm" | "lg" }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.markWonButton");

  return (
    <Button
      size={size}
      variant="success"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await updateDealStatus(linkId, "WON");
            toast.success(t("won"));
          } catch {
            toast.error(t("failed"));
          }
        })
      }
    >
      <Trophy />
      {t("label")}
    </Button>
  );
}
