"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setLinkShared } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";

/** Same URL, now a Smart Link: the emails already sent start naming their readers. */
export function MakeSmartLinkButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const t = useTranslations("deal.smartLinkProblem");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setLinkShared(linkId, true);
          if ("error" in result) return void toast.error(result.error);
          toast.success(t("converted"));
          router.refresh();
        })
      }
    >
      {t("convert")}
    </Button>
  );
}
