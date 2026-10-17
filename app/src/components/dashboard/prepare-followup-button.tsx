"use client";

import { PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { prepareFollowupFromInsight } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";

export function PrepareFollowupButton({
  linkId,
  size = "sm",
  variant = "outline",
}: {
  linkId: string;
  size?: "sm" | "lg";
  variant?: "default" | "outline";
}) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.prepareFollowupButton");

  return (
    <Button
      size={size}
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await prepareFollowupFromInsight(linkId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(t("ready"));
          document.getElementById("relances")?.scrollIntoView({ behavior: "smooth" });
        })
      }
    >
      <PenLine /> {pending ? t("writing") : t("label")}
    </Button>
  );
}
