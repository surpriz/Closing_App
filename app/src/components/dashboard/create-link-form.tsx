"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createQuickLink } from "@/app/(dashboard)/documents/actions";
import { Button } from "@/components/ui/button";

/**
 * One click: a new link with the usual settings, then the share screen where
 * the seller says who it is for. No form to fill first.
 */
export function NewLinkButton({
  documentId,
  variant = "default",
  label,
}: {
  documentId: string;
  variant?: "default" | "outline";
  /** "Créer le lien" when the document has none yet. */
  label?: string;
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
          const result = await createQuickLink(documentId);
          if ("error" in result) toast.error(result.error);
          else router.push(`/links/${result.linkId}?new=1`);
        })
      }
    >
      <Plus />
      {pending ? t("creating") : (label ?? t("defaultLabel"))}
    </Button>
  );
}
