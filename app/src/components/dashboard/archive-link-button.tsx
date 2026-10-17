"use client";

import { Archive } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("deal.archiveLinkButton");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-lg" aria-label={t("ariaLabel")} />}>
        <Archive />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("keep")}</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => archiveLink(linkId))}
          >
            {pending ? t("archiving") : t("archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
