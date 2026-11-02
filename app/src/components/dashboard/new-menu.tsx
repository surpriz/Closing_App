"use client";

import { ChevronDown, FileUp, Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { openAddDocument } from "./upload-dropzone";

/**
 * The landing's two doors, in the header: a send (a document or a link, the usual way) or a campaign
 * from the seller's own mailbox. Shown instead of "Ajouter un document" once campaigns are open.
 */
export function NewMenu() {
  const router = useRouter();
  const t = useTranslations("nav.newMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label={t("label")} className="max-sm:size-9 max-sm:px-0" />}
      >
        <Plus />
        <span className="max-sm:sr-only">{t("label")}</span>
        <ChevronDown className="max-sm:hidden" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={openAddDocument}>
          <FileUp />
          <span className="flex flex-col">
            {t("send")}
            <span className="text-micro text-muted-foreground">{t("sendHint")}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/campaigns")}>
          <Send />
          <span className="flex flex-col">
            {t("campaign")}
            <span className="text-micro text-muted-foreground">{t("campaignHint")}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
