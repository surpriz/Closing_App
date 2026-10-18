"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reactivateLink } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EXTENSION_DAYS } from "@/lib/closing/expiry";

type Props = {
  linkId: string;
  /** The deadline passed: the seller picks how much time to give. */
  expired: boolean;
  /** An "available again" draft can be written: open deal, follow-ups on, someone the seller sent it to. */
  canDraft: boolean;
  size?: "sm" | "default";
};

export function ReactivateLinkButton({ linkId, expired, canDraft, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number>(7);
  const [draft, setDraft] = useState(canDraft);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("deal.reactivateLinkButton");

  const confirm = () =>
    startTransition(async () => {
      const result = await reactivateLink(linkId, { days: expired ? days : undefined, draft: canDraft && draft });
      if ("error" in result) return void toast.error(result.error);
      const parts = [
        t("done"),
        result.told > 0 && t("told", { count: result.told }),
        result.drafted && t("drafted"),
      ].filter(Boolean);
      toast.success(parts.join(" · "));
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={size} />}>
        <RotateCcw />
        {t("trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {expired && (
          <div className="space-y-2">
            <p className="text-small text-muted-foreground">{t("daysLabel")}</p>
            <div className="flex flex-wrap gap-1.5">
              {EXTENSION_DAYS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={option === days ? "default" : "outline"}
                  aria-pressed={option === days}
                  onClick={() => setDays(option)}
                >
                  {t("plusDays", { days: option })}
                </Button>
              ))}
            </div>
          </div>
        )}

        {canDraft && (
          <label className="flex items-start gap-2.5 text-small">
            <Checkbox checked={draft} onCheckedChange={setDraft} className="mt-0.5" />
            <span>
              {t("draft")}
              <span className="block text-muted-foreground">{t("draftHint")}</span>
            </span>
          </label>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
          <Button disabled={pending} onClick={confirm}>
            {pending ? t("reactivating") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
