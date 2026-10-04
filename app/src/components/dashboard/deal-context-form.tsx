"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { saveDealContext, type LinkFormState } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"];

type Props = {
  linkId: string;
  initial: {
    version: string;
    dealAmount: string;
    dealCurrency: string;
    decisionDeadline: string;
    decisionMakerName: string;
    decisionMakerRole: string;
    sellerNotes: string;
  };
};

// What only the seller knows about the deal. Feeds the analysis, never shown to the prospect.
export function DealContextForm({ linkId, initial }: Props) {
  const [state, formAction, pending] = useActionState<LinkFormState, FormData>(
    saveDealContext.bind(null, linkId),
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success("Contexte enregistré");
  }, [state]);

  return (
    <form action={formAction} className="space-y-3 px-4 py-3">
      <div key={initial.version} className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="dealAmount">Montant du deal</Label>
            <Input id="dealAmount" name="dealAmount" inputMode="decimal" defaultValue={initial.dealAmount} placeholder="12 000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dealCurrency">Devise</Label>
            <select
              id="dealCurrency"
              name="dealCurrency"
              defaultValue={initial.dealCurrency}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="decisionDeadline">Décision attendue avant le</Label>
          <Input id="decisionDeadline" name="decisionDeadline" type="date" defaultValue={initial.decisionDeadline} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="decisionMakerName">Décideur</Label>
            <Input id="decisionMakerName" name="decisionMakerName" defaultValue={initial.decisionMakerName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decisionMakerRole">Son rôle</Label>
            <Input
              id="decisionMakerRole"
              name="decisionMakerRole"
              defaultValue={initial.decisionMakerRole}
              placeholder="DAF, CEO…"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sellerNotes">Vos notes</Label>
          <Textarea
            id="sellerNotes"
            name="sellerNotes"
            rows={3}
            defaultValue={initial.sellerNotes}
            placeholder="Budget serré, compare avec un concurrent, veut démarrer en janvier…"
          />
          <p className="text-xs text-muted-foreground">
            Servent à l&apos;analyse du deal. Jamais reprises telles quelles dans un message au prospect.
          </p>
        </div>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
