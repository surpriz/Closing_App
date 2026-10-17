"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { reanalyzeDeal } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReanalyzeButton({ linkId, label }: { linkId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.reanalyzeButton");

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reanalyzeDeal(linkId);
          if (result.error) toast.error(result.error);
          else toast.success(t("done"));
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} /> {pending ? t("analyzing") : (label ?? t("label"))}
    </Button>
  );
}
