"use client";

import { Settings2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveLinkSettings, type LinkFormState } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

function LinkSettingsForm({ linkId, initial, defaults }: Props) {
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
      <div key={initial.version} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="link-name">Nom du lien</Label>
          <Input id="link-name" name="name" defaultValue={initial.name} />
        </div>

        <div className="space-y-2">
          <FormCheckbox name="requireEmail" label="Demander l'email avant lecture" defaultChecked={initial.requireEmail} />
          <FormCheckbox name="ctaEnabled" label="Afficher les boutons « Valider » et « Demander un ajustement »" defaultChecked={initial.ctaEnabled} />
          <FormCheckbox name="followupsEnabled" label="Relances automatiques" defaultChecked={initial.followupsEnabled} />
        </div>

        <div className="space-y-2">
          <Label>Relancer par</Label>
          <div className="flex gap-4">
            <FormCheckbox name="channels" value="EMAIL" label="Email" defaultChecked={initial.channels.includes("EMAIL")} />
            <FormCheckbox name="channels" value="WHATSAPP" label="WhatsApp" defaultChecked={initial.channels.includes("WHATSAPP")} />
          </div>
          <p className="text-sm text-muted-foreground">
            Rien de coché : comme dans les réglages ({defaults.channels.join(", ").toLowerCase()}).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="link-threshold">Secondes sur les tarifs</Label>
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
            <Label htmlFor="link-inactivity">Jours sans ouverture</Label>
            <Input
              id="link-inactivity"
              name="inactivityDays"
              defaultValue={initial.inactivityDays.join(", ")}
              placeholder={`${defaults.inactivityDays.join(", ")} par défaut`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-start">Envoyer à partir de (h)</Label>
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

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les réglages du lien"}
        </Button>
      </div>
    </form>
  );
}

export function LinkSettingsDialog(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="bg-card" />}>
        <Settings2 />
        Réglages du lien
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Réglages du lien</DialogTitle>
          <DialogDescription>Un champ laissé vide reprend les réglages de l&apos;espace.</DialogDescription>
        </DialogHeader>
        <LinkSettingsForm {...props} />
      </DialogContent>
    </Dialog>
  );
}
