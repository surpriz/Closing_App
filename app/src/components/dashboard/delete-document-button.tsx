"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

import { archiveDocument } from "@/app/(dashboard)/documents/actions";
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

export function DeleteDocumentButton({ documentId, linkCount }: { documentId: string; linkCount: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Supprimer le devis" className="text-muted-foreground hover:text-foreground" />}>
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer ce devis ?</DialogTitle>
          <DialogDescription>
            {linkCount === 0
              ? "Il disparaît de Clozer."
              : linkCount === 1
                ? "Le lien envoyé à votre prospect ne s'ouvrira plus, et ses relances prévues sont annulées."
                : `Les ${linkCount} liens envoyés ne s'ouvriront plus, et leurs relances prévues sont annulées.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Garder le devis</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => archiveDocument(documentId))}
          >
            {pending ? "Suppression…" : "Supprimer le devis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
