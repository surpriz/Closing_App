"use client";

import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { prepareCallScriptForDeal } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";

import { CopyButton } from "./copy-button";

/** "Préparer l'appel": what to say, ask and answer, from the latest analysis of the deal. */
export function CallScriptButton({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();
  const [script, setScript] = useState<string | null>(null);
  const t = useTranslations("deal.callScript");

  if (script) {
    return (
      <div className="space-y-2 border-l-2 border-foreground pl-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-small font-medium">{t("title")}</p>
          <CopyButton value={script} />
        </div>
        <p className="text-small whitespace-pre-line">{script}</p>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await prepareCallScriptForDeal(linkId);
          if (result.error) toast.error(result.error);
          else if (result.script) setScript(result.script);
        })
      }
    >
      <Phone /> {pending ? t("writing") : t("label")}
    </Button>
  );
}
