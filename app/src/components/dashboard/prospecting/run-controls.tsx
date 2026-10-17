"use client";

import { Scale, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { startSearchAction } from "@/app/(dashboard)/prospecting/actions";
import { Button } from "@/components/ui/button";

import { providerLabel } from "./labels";

type Props = {
  providers: string[];
  disabled: boolean;
};

export function RunControls({ providers, disabled }: Props) {
  const t = useTranslations("prospecting.runControls");
  const tl = useTranslations("prospecting.labels");
  const [pending, startTransition] = useTransition();

  const start = (selected: string[]) =>
    startTransition(async () => {
      const result = await startSearchAction(selected);
      if ("error" in result) toast.error(result.error);
      else toast.success(t("started"));
    });

  if (providers.length === 0) {
    return <p className="text-small text-muted-foreground">{t("noProvider")}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {providers.map((provider, index) => (
        <Button
          key={provider}
          variant={index === 0 ? "default" : "outline"}
          disabled={disabled || pending}
          onClick={() => start([provider])}
        >
          <Search aria-hidden />
          {t("searchWith", { provider: providerLabel(tl, provider) })}
        </Button>
      ))}
      {providers.length > 1 && (
        <Button variant="ghost" disabled={disabled || pending} onClick={() => start(providers)}>
          <Scale aria-hidden />
          {t("compare")}
        </Button>
      )}
    </div>
  );
}
