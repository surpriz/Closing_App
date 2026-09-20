"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { createLink, type CreateLinkState } from "@/app/(dashboard)/documents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function CreateLinkForm({
  documentId,
  disabled,
}: {
  documentId: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<CreateLinkState, FormData>(
    createLink.bind(null, documentId),
    null,
  );
  const [requireEmail, setRequireEmail] = useState(true);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.url) {
      const fullUrl = `${window.location.origin}${state.url}`;
      navigator.clipboard?.writeText(fullUrl).catch(() => {});
      toast.success("Lien créé et copié dans le presse-papier.");
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="prospectCompany">Entreprise</Label>
          <Input id="prospectCompany" name="prospectCompany" placeholder="Acme SAS" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prospectName">Contact</Label>
          <Input id="prospectName" name="prospectName" placeholder="Marie Martin" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prospectEmail">Email du prospect</Label>
          <Input id="prospectEmail" name="prospectEmail" type="email" placeholder="marie@acme.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom du lien</Label>
          <Input id="name" name="name" placeholder="Acme – V1" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={requireEmail} onCheckedChange={(checked) => setRequireEmail(checked)} />
          Demander l&apos;email avant lecture
          <input type="hidden" name="requireEmail" value={requireEmail ? "true" : "false"} />
        </label>
        <Button type="submit" disabled={pending || disabled}>
          {pending ? "Création…" : "Créer le lien"}
        </Button>
      </div>
      {disabled && (
        <p className="text-xs text-muted-foreground">Disponible une fois l&apos;analyse du document terminée.</p>
      )}
    </form>
  );
}
