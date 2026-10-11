"use client";

import { Search } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { startSearchAction } from "@/app/(dashboard)/prospection/actions";
import { Button } from "@/components/ui/button";

import { PROVIDER_LABELS } from "./labels";

type Props = {
  providers: string[];
  disabled: boolean;
};

export function RunControls({ providers, disabled }: Props) {
  const [pending, startTransition] = useTransition();

  const start = (provider: string) =>
    startTransition(async () => {
      const result = await startSearchAction(provider);
      if ("error" in result) toast.error(result.error);
      else toast.success("Recherche lancée");
    });

  if (providers.length === 0) {
    return <p className="text-small text-muted-foreground">Aucun fournisseur configuré (APOLLO_API_KEY, LEMLIST_API_KEY).</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {providers.map((provider, index) => (
        <Button
          key={provider}
          variant={index === 0 ? "default" : "outline"}
          disabled={disabled || pending}
          onClick={() => start(provider)}
        >
          <Search aria-hidden />
          Chercher avec {PROVIDER_LABELS[provider] ?? provider}
        </Button>
      ))}
    </div>
  );
}
