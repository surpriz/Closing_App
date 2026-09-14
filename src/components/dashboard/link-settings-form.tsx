"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { saveLinkSettings, type LinkFormState } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FormCheckbox } from "./form-checkbox";

type Props = {
  linkId: string;
  initial: {
    version: string;
    name: string;
    requireEmail: boolean;
    ctaEnabled: boolean;
    followupsEnabled: boolean;
    channels: string[];
    hotPricingThresholdSec: number | null;
    inactivityDays: number[];
    businessHourStart: number | null;
    businessHourEnd: number | null;
  };
  defaults: {
    channels: string[];
    hotPricingThresholdSec: number;
    inactivityDays: number[];
    businessHourStart: number;
    businessHourEnd: number;
  };
};

export function LinkSettingsForm({ linkId, initial, defaults }: Props) {
  const [state, formAction, pending] = useActionState<LinkFormState, FormData>(
    saveLinkSettings.bind(null, linkId),
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Réglages du lien enregistrés");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      {/* Remount the fields after each save so uncontrolled inputs show stored values */}
      <div key={initial.version} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="link-name">Nom du lien</Label>
          <Input id="link-name" name="name" defaultValue={initial.name} />
        </div>

        <div className="space-y-2">
          <FormCheckbox name="requireEmail" label="Demander l'email avant lecture" defaultChecked={initial.requireEmail} />
          <FormCheckbox name="ctaEnabled" label="Boutons « Valider » et « Ajustement »" defaultChecked={initial.ctaEnabled} />
          <FormCheckbox name="followupsEnabled" label="Relances automatiques" defaultChecked={initial.followupsEnabled} />
        </div>

        <div className="space-y-2">
          <Label>Canaux de relance</Label>
          <div className="flex gap-4">
            <FormCheckbox name="channels" value="EMAIL" label="Email" defaultChecked={initial.channels.includes("EMAIL")} />
            <FormCheckbox name="channels" value="WHATSAPP" label="WhatsApp" defaultChecked={initial.channels.includes("WHATSAPP")} />
          </div>
          <p className="text-xs text-muted-foreground">
            Aucun coché : canaux par défaut ({defaults.channels.join(", ").toLowerCase()}).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="link-threshold">Seuil tarifs (s)</Label>
            <Input
              id="link-threshold"
              name="hotPricingThresholdSec"
              type="number"
              min={10}
              max={3600}
              defaultValue={initial.hotPricingThresholdSec ?? ""}
              placeholder={`${defaults.hotPricingThresholdSec} par défaut`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-inactivity">Anti-ghosting (jours)</Label>
            <Input
              id="link-inactivity"
              name="inactivityDays"
              defaultValue={initial.inactivityDays.join(", ")}
              placeholder={`${defaults.inactivityDays.join(", ")} par défaut`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-start">Envoi dès (h)</Label>
            <Input
              id="link-start"
              name="businessHourStart"
              type="number"
              min={0}
              max={23}
              defaultValue={initial.businessHourStart ?? ""}
              placeholder={`${defaults.businessHourStart} par défaut`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-end">Jusqu&apos;à (h)</Label>
            <Input
              id="link-end"
              name="businessHourEnd"
              type="number"
              min={1}
              max={24}
              defaultValue={initial.businessHourEnd ?? ""}
              placeholder={`${defaults.businessHourEnd} par défaut`}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
