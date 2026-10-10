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
    chatEnabled: boolean;
    voiceCommentsEnabled: boolean;
    followupsEnabled: boolean;
  };
};

function LinkSettingsForm({ linkId, initial }: Props) {
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
          <FormCheckbox
            name="chatEnabled"
            label="Assistant qui répond aux questions du prospect"
            hint="Il répond uniquement à partir du document et vous transmet ce qu'il ne sait pas."
            defaultChecked={initial.chatEnabled}
          />
          <FormCheckbox
            name="voiceCommentsEnabled"
            label="Commentaires vocaux du prospect"
            hint="Sur les PDF : il enregistre jusqu'à 60 secondes sur une page, vous recevez l'audio et sa transcription."
            defaultChecked={initial.voiceCommentsEnabled}
          />
          <FormCheckbox
            name="followupsEnabled"
            label="Pilote automatique sur ce deal"
            hint="Décoché : Clozer continue d'analyser le deal mais ne prépare plus aucune relance."
            defaultChecked={initial.followupsEnabled}
          />
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
          <DialogDescription>Ce que voit le prospect, et si Clozer s&apos;occupe des relances.</DialogDescription>
        </DialogHeader>
        <LinkSettingsForm {...props} />
      </DialogContent>
    </Dialog>
  );
}
