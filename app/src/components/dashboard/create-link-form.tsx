"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { createLink, type CreateLinkState } from "@/app/(dashboard)/documents/actions";
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
import { Switch } from "@/components/ui/switch";

function CreateLinkForm({ documentId, onCreated }: { documentId: string; onCreated: () => void }) {
  const [state, formAction, pending] = useActionState<CreateLinkState, FormData>(
    createLink.bind(null, documentId),
    null,
  );
  const [requireEmail, setRequireEmail] = useState(true);
  const created = useEffectEvent(onCreated);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.url) {
      const fullUrl = `${window.location.origin}${state.url}`;
      navigator.clipboard?.writeText(fullUrl).catch(() => {});
      toast.success("Lien créé et copié. Collez-le dans votre email au prospect.");
      created();
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="prospectCompany">Entreprise</Label>
          <Input id="prospectCompany" name="prospectCompany" placeholder="Acme SAS" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prospectName">Contact</Label>
          <Input id="prospectName" name="prospectName" placeholder="Marie Martin" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prospectEmail">Email du contact</Label>
        <Input id="prospectEmail" name="prospectEmail" type="email" placeholder="marie@acme.com" />
        <p className="text-sm text-muted-foreground">Pour les relances. Sans email, pas de relance automatique.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Nom du lien <span className="font-normal text-muted-foreground">(facultatif)</span>
        </Label>
        <Input id="name" name="name" placeholder="Acme, version 2" />
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
        Demander son email au lecteur avant d&apos;ouvrir le devis
        <Switch checked={requireEmail} onCheckedChange={(checked) => setRequireEmail(checked)} />
        <input type="hidden" name="requireEmail" value={requireEmail ? "true" : "false"} />
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Création…" : "Créer le lien"}
      </Button>
    </form>
  );
}

export function NewLinkDialog({
  documentId,
  disabled,
  variant = "default",
}: {
  documentId: string;
  disabled: boolean;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        disabled={disabled}
        render={<Button size="lg" variant={variant} />}
        title={disabled ? "Disponible une fois l'analyse du devis terminée" : undefined}
      >
        <Plus />
        Nouveau lien prospect
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Nouveau lien prospect</DialogTitle>
          <DialogDescription>
            Un lien par prospect : vous saurez exactement qui lit, et quand le relancer.
          </DialogDescription>
        </DialogHeader>
        <CreateLinkForm documentId={documentId} onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
