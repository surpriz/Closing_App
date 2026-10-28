"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markLinkAsTest } from "@/app/(dashboard)/links/actions";

/** One of the seller's own tests showing as a prospect: wiped from the counts in one click. */
export function MarkAsTestButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const t = useTranslations("deal.markAsTest");
  const [pending, startTransition] = useTransition();

  return (
    <p className="text-small text-muted-foreground">
      {t("question")}{" "}
      <button
        type="button"
        disabled={pending}
        className="font-medium text-foreground underline underline-offset-4"
        onClick={() => {
          if (!window.confirm(t("confirm"))) return;
          startTransition(async () => {
            const result = await markLinkAsTest(linkId);
            if ("error" in result) return void toast.error(result.error);
            toast.success(t("done"));
            router.push(`/documents/${result.documentId}`);
          });
        }}
      >
        {t("action")}
      </button>
    </p>
  );
}
