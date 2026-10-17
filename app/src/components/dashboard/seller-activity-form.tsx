"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { logSellerActivity, snoozeDeal, type LinkFormState } from "@/app/(dashboard)/links/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INTL_LOCALE } from "@/i18n/locale";

const TYPES = ["CALL", "EMAIL_REPLY_RECEIVED", "MEETING", "NOTE"] as const;

// Calls, replies and meetings happen outside Clozer: logging them keeps the advice honest
export function SellerActivityForm({ linkId }: { linkId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations("deal.sellerActivityForm");
  const tl = useTranslations("labels");
  const [state, formAction, pending] = useActionState<LinkFormState, FormData>(
    logSellerActivity.bind(null, linkId),
    null,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(t("logged"));
      formRef.current?.reset();
    }
  }, [state, t]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 py-4">
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1.5 text-small">
        <legend className="sr-only">{t("typeLegend")}</legend>
        {TYPES.map((type, i) => (
          <label key={type} className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="type" value={type} defaultChecked={i === 0} className="accent-foreground" />
            {tl(`sellerActivity.${type}`)}
          </label>
        ))}
      </fieldset>
      <Textarea name="note" rows={2} aria-label={t("noteAria")} placeholder={t("notePlaceholder")} />
      <div className="space-y-1.5">
        <Label htmlFor="occurredAt">{t("when")}</Label>
        <Input id="occurredAt" name="occurredAt" type="datetime-local" />
        <p className="text-small text-muted-foreground">{t("whenHint")}</p>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}

export function SnoozeControl({ linkId, snoozedUntil }: { linkId: string; snoozedUntil: string | null }) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const t = useTranslations("deal.sellerActivityForm");
  const locale = useLocale();

  if (snoozedUntil) {
    return (
      <div className="flex items-center justify-between gap-3 py-3 text-small">
        <span>
          {t("pausedUntil", {
            date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long" }).format(
              new Date(snoozedUntil),
            ),
          })}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await snoozeDeal(linkId, null);
              toast.success(t("resumed"));
            })
          }
        >
          {t("resume")}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-1.5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await snoozeDeal(linkId, date);
          if (result.error) toast.error(result.error);
          else toast.success(t("pausedToast"));
        });
      }}
    >
      <Label htmlFor="snoozeUntil">{t("pauseLabel")}</Label>
      <div className="flex gap-2">
        <Input id="snoozeUntil" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {t("pause")}
        </Button>
      </div>
      <p className="text-small text-muted-foreground">{t("pauseHint")}</p>
    </form>
  );
}
