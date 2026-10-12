"use client";

import { useState, useTransition } from "react";

import { reactivateWorkspace, suspendWorkspace } from "@/app/admin/workspace-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { report } from "./user-actions";

export function WorkspaceActions({ id, name, suspended }: { id: string; name: string; suspended: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (suspended) {
    return (
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => void report(await reactivateWorkspace(id), `${name} est réactivé`))}
      >
        Réactiver l&apos;espace
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Suspendre l&apos;espace</DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          action={(formData) =>
            startTransition(async () => {
              if (report(await suspendWorkspace(id, formData), `${name} est suspendu`)) setOpen(false);
            })
          }
        >
          <DialogHeader>
            <DialogTitle>Suspendre {name} ?</DialogTitle>
            <DialogDescription>
              Tous les membres perdent l&apos;accès, les liens envoyés ne s&apos;ouvrent plus et les relances
              s&apos;arrêtent. Aucune donnée n&apos;est supprimée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Motif</Label>
            <Textarea id="suspend-reason" name="reason" required minLength={3} maxLength={500} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Annuler</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Suspension…" : "Suspendre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
