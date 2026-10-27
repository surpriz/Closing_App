"use client";

import { Mail, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createQuickLink } from "@/app/(dashboard)/documents/actions";
import { isUpgradePrompt, openUpgrade } from "@/components/billing/upgrade-dialog";
import { Button } from "@/components/ui/button";

/**
 * One click: a new link with the usual settings, then the share screen where
 * the seller says who it is for. No form to fill first. `smart`: a Smart Link
 * for a cold email sequence, never a personal link turned into one later.
 */
export function NewLinkButton({
  documentId,
  variant = "default",
  label,
  smart = false,
}: {
  documentId: string;
  variant?: "default" | "outline";
  /** "Créer le lien" when the document has none yet. */
  label?: string;
  smart?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("deal.newLinkButton");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createQuickLink(documentId, { smart });
          if (isUpgradePrompt(result)) openUpgrade(result);
          else if ("error" in result) toast.error(result.error);
          else router.push(`/links/${result.linkId}?new=1`);
        })
      }
    >
      {smart ? <Mail /> : <Plus />}
      {pending ? t("creating") : (label ?? t(smart ? "smartLabel" : "defaultLabel"))}
    </Button>
  );
}
