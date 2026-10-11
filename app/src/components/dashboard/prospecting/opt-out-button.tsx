"use client";

import { Ban } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { optOutSuggestionAction } from "@/app/(dashboard)/prospection/actions";
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

/** Global and final: asked first. */
export function OptOutButton({ suggestionId, name }: { suggestionId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await optOutSuggestionAction(suggestionId);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Cette personne ne sera plus jamais proposée");
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <Ban aria-hidden />
        Ne plus proposer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name} ne souhaite pas être contacté ?</DialogTitle>
          <DialogDescription>
            Clozer ne proposera plus jamais cette personne, à vous ni à personne d&apos;autre, et efface ce qu&apos;il
            savait d&apos;elle. Les liens déjà créés pour elle n&apos;enverront plus rien. C&apos;est définitif.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
          <Button variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? "Enregistrement…" : "Ne plus jamais proposer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
