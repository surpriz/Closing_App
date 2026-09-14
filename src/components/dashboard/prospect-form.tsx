"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { saveProspect, type LinkFormState } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FormCheckbox } from "./form-checkbox";

type Props = {
  linkId: string;
  prospect?: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    phoneE164: string | null;
    whatsappOptIn: boolean;
  };
};

// Edits an existing contact, or adds one when `prospect` is omitted
export function ProspectForm({ linkId, prospect }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<LinkFormState, FormData>(
    saveProspect.bind(null, linkId, prospect?.id ?? null),
    null,
  );
  const prefix = prospect?.id ?? "new";

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(prospect ? "Contact mis à jour" : "Contact ajouté");
      if (!prospect) formRef.current?.reset();
    }
  }, [state, prospect]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 pt-3">
      {!prospect && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-email`}>Email</Label>
          <Input id={`${prefix}-email`} name="email" type="email" required />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-name`}>Nom</Label>
          <Input id={`${prefix}-name`} name="name" defaultValue={prospect?.name ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-company`}>Entreprise</Label>
          <Input id={`${prefix}-company`} name="company" defaultValue={prospect?.company ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-phone`}>Téléphone mobile</Label>
        <Input
          id={`${prefix}-phone`}
          name="phone"
          type="tel"
          defaultValue={prospect?.phoneE164 ?? ""}
          placeholder="+33612345678"
        />
      </div>
      <FormCheckbox
        name="whatsappOptIn"
        label="Accepte d'être contacté sur WhatsApp"
        hint="Obligatoire pour les relances WhatsApp : cochez seulement si le prospect l'a accepté."
        defaultChecked={prospect?.whatsappOptIn ?? false}
      />
      <Button type="submit" size="sm" variant={prospect ? "outline" : "default"} disabled={pending}>
        {pending ? "Enregistrement…" : prospect ? "Enregistrer" : "Ajouter le contact"}
      </Button>
    </form>
  );
}
