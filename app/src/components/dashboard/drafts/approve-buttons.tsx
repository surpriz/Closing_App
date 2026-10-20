"use client";

import { Check, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { approveAllDrafts, approveFollowup } from "@/app/(dashboard)/followup-actions";
import { Button } from "@/components/ui/button";

export function ApproveDraftButton({ followupId }: { followupId: string }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("drafts");
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await approveFollowup(followupId);
          if (result.error) toast.error(result.error);
          else toast.success(t("approved"));
        })
      }
    >
      <Check /> {t("approve")}
    </Button>
  );
}

/** Every draft at once: each still goes through the send-time checks (reply, opening, expiry…). */
export function ApproveAllButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("drafts");
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { approved } = await approveAllDrafts();
          toast.success(t("approvedAll", { count: approved }));
        })
      }
    >
      <CheckCheck /> {t("approveAll", { count })}
    </Button>
  );
}
