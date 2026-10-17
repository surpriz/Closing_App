"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("documents.delete");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-lg" aria-label={t("aria")} className="text-muted-foreground hover:text-foreground" />}>
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {linkCount === 0
              ? t("none")
              : linkCount === 1
                ? t("one")
                : t("many", { count: linkCount })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("keep")}</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => archiveDocument(documentId))}
          >
            {pending ? t("deleting") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
