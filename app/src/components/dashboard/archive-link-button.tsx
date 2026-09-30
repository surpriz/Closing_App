"use client";

import { Archive } from "lucide-react";
import { useState, useTransition } from "react";

import { archiveLink } from "@/app/(dashboard)/links/actions";
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

export function ArchiveLinkButton({ linkId }: { linkId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Archiver le lien" />}>
        <Archive />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archiver ce lien ?</DialogTitle>
          <DialogDescription>
            Le prospect ne pourra plus ouvrir le document, et les relances prévues sont annulées.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Garder le lien</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => archiveLink(linkId))}
          >
            {pending ? "Archivage…" : "Archiver le lien"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
