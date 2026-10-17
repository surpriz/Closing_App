"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { revokeExtensionToken } from "@/app/extension/actions";
import { OutlookManifestLink } from "@/components/dashboard/outlook-manifest-link";
import { ExtensionStatus } from "@/components/onboarding/extension-status";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";
import { OUTLOOK_TOKEN_LABEL } from "@/lib/extension-tokens";
import type { ExtensionProbe } from "@/lib/onboarding";

export type ExtensionTokenRow = {
  id: string;
  label: string | null;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const dateFormats = new Map<UiLocale, Intl.DateTimeFormat>();

function dateFormat(locale: UiLocale) {
  let format = dateFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    dateFormats.set(locale, format);
  }
  return format;
}

function RevokeButton({ id }: { id: string }) {
  const t = useTranslations("settings.extensionTokens");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("revoke")}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("revokeTitle")}</DialogTitle>
          <DialogDescription>{t("revokeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await revokeExtensionToken(id);
                setOpen(false);
              })
            }
          >
            {pending ? t("revoking") : t("revoke")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TokenList({ tokens }: { tokens: ExtensionTokenRow[] }) {
  const t = useTranslations("settings.extensionTokens");
  const format = dateFormat(useLocale());
  if (tokens.length === 0)
    return (
      <p className="px-5 py-3 text-small text-muted-foreground">
        {t("nothingConnected")}
      </p>
    );
  return (
    <ul className="divide-y divide-border">
      {tokens.map((token) => (
        <li
          key={token.id}
          className="flex items-center justify-between gap-4 px-5 py-3"
        >
          <div className="min-w-0">
            <p className="text-body">
              {token.label === OUTLOOK_TOKEN_LABEL ? t("outlookToken") : (token.label ?? t("browser"))}{" "}
              <span className="font-mono text-small text-muted-foreground">
                …{token.hint}
              </span>
            </p>
            <p className="text-small text-muted-foreground">
              {t("connectedOn", { date: format.format(new Date(token.createdAt)) })}
              {token.lastUsedAt &&
                t("usedOn", { date: format.format(new Date(token.lastUsedAt)) })}
            </p>
          </div>
          <RevokeButton id={token.id} />
        </li>
      ))}
    </ul>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col bg-card">
      <div className="space-y-0.5 px-5 pt-4 pb-3">
        <p className="text-body font-semibold">{title}</p>
        <p className="text-small text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** "Chrome et Outlook": one card per mail tool, with how to install it and what is connected. */
export function ExtensionTokens({
  tokens,
  chromeStoreUrl,
  probe,
}: {
  tokens: ExtensionTokenRow[];
  chromeStoreUrl: string | null;
  probe: ExtensionProbe;
}) {
  const t = useTranslations("settings.extensionTokens");
  const chrome = tokens.filter((token) => token.label !== OUTLOOK_TOKEN_LABEL);
  const outlook = tokens.filter((token) => token.label === OUTLOOK_TOKEN_LABEL);

  return (
    <section id="extension" className="scroll-mt-24 space-y-3">
      <div className="space-y-1">
        <h2 className="text-heading">{t("title")}</h2>
        <p className="text-body text-muted-foreground">{t("description")}</p>
      </div>
      <div className="grid gap-px border-y border-foreground bg-border sm:grid-cols-2">
        <Card title="Chrome" hint={t("chromeHint")}>
          <div className="px-5 pb-4">
            {chromeStoreUrl ? (
              <a
                href={chromeStoreUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                {t("installChrome")}
              </a>
            ) : (
              <p className="text-small text-muted-foreground">
                {t("chromeSoon")}
              </p>
            )}
          </div>
          <ExtensionStatus probe={probe} />
          <div className="border-t border-border">
            <TokenList tokens={chrome} />
          </div>
        </Card>
        <Card title="Outlook" hint={t("outlookHint")}>
          <ol className="list-decimal space-y-1 px-5 pb-4 pl-9 text-small text-muted-foreground">
            <li>
              <OutlookManifestLink className="underline hover:text-foreground">
                {t("outlookStep1Link")}
              </OutlookManifestLink>
              .
            </li>
            <li>{t("outlookStep2")}</li>
            <li>{t("outlookStep3")}</li>
          </ol>
          <p className="px-5 pb-4 text-small text-muted-foreground">
            {t("outlookAdmin")}
          </p>
          <div className="border-t border-border">
            <TokenList tokens={outlook} />
          </div>
        </Card>
      </div>
    </section>
  );
}
