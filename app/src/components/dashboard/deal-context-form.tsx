"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { saveDealContext, type LinkFormState } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FormCheckbox } from "./form-checkbox";

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
    referenceConsent: boolean;
  };
};

// What only the seller knows about the deal. Feeds the analysis, never shown to the prospect.
export function DealContextForm({ linkId, initial }: Props) {
  const t = useTranslations("deal.dealContextForm");
  const [state, formAction, pending] = useActionState<LinkFormState, FormData>(
    saveDealContext.bind(null, linkId),
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(t("saved"));
  }, [state, t]);

  return (
    <form action={formAction} className="space-y-3 py-4">
      <div key={initial.version} className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="dealAmount">{t("amount")}</Label>
            <Input id="dealAmount" name="dealAmount" inputMode="decimal" defaultValue={initial.dealAmount} placeholder={t("amountPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dealCurrency">{t("currency")}</Label>
            <select
              id="dealCurrency"
              name="dealCurrency"
              defaultValue={initial.dealCurrency}
              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-body"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="decisionDeadline">{t("deadline")}</Label>
          <Input id="decisionDeadline" name="decisionDeadline" type="date" defaultValue={initial.decisionDeadline} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="decisionMakerName">{t("decisionMaker")}</Label>
            <Input id="decisionMakerName" name="decisionMakerName" defaultValue={initial.decisionMakerName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decisionMakerRole">{t("role")}</Label>
            <Input
              id="decisionMakerRole"
              name="decisionMakerRole"
              defaultValue={initial.decisionMakerRole}
              placeholder={t("rolePlaceholder")}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sellerNotes">{t("notes")}</Label>
          <Textarea
            id="sellerNotes"
            name="sellerNotes"
            rows={3}
            defaultValue={initial.sellerNotes}
            placeholder={t("notesPlaceholder")}
          />
          <p className="text-small text-muted-foreground">
            {t("notesHint")}
          </p>
        </div>
        <FormCheckbox
          name="referenceConsent"
          label={t("referenceConsent")}
          hint={t("referenceConsentHint")}
          defaultChecked={initial.referenceConsent}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
