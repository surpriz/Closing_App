"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { createCampaignAction } from "@/app/(dashboard)/campaigns/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type State = { error: string } | null;

export function NewCampaignDialog({
  mailboxes,
  defaultMailboxId,
  defaultLocale,
}: {
  mailboxes: { id: string; email: string }[];
  /** The signed-in seller's own mailbox when it is ACTIVE. */
  defaultMailboxId: string | null;
  defaultLocale: "fr" | "en";
}) {
  const t = useTranslations("campaigns.new");
  const tp = useTranslations("campaigns.page");
  const [mailboxId, setMailboxId] = useState(defaultMailboxId ?? mailboxes[0]?.id ?? "");
  const [locale, setLocale] = useState<string>(defaultLocale);
  const mailboxItems = mailboxes.map((mailbox) => ({ value: mailbox.id, label: mailbox.email }));
  const localeItems = [
    { value: "fr", label: t("localeFr") },
    { value: "en", label: t("localeEn") },
  ];

  // A successful creation redirects, so only errors come back here
  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    return (await createCampaignAction(formData)) ?? null;
  }, null);

  const disabled = mailboxes.length === 0;

  return (
    <Dialog>
      <DialogTrigger render={<Button disabled={disabled} />}>{tp("newCampaign")}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="campaign-name" className="text-small font-medium">
              {t("name")}
            </label>
            <Input
              id="campaign-name"
              name="name"
              required
              maxLength={120}
              autoComplete="off"
              placeholder={t("namePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-small font-medium">{t("mailbox")}</span>
            <input type="hidden" name="mailboxId" value={mailboxId} />
            <Select items={mailboxItems} value={mailboxId} onValueChange={(value) => value && setMailboxId(value)}>
              <SelectTrigger aria-label={t("mailbox")} className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mailboxItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="text-small font-medium">{t("locale")}</span>
            <input type="hidden" name="locale" value={locale} />
            <Select items={localeItems} value={locale} onValueChange={(value) => value && setLocale(value)}>
              <SelectTrigger aria-label={t("locale")} className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {localeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state && (
            <p role="alert" className="text-small text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || !mailboxId}>
              {pending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
