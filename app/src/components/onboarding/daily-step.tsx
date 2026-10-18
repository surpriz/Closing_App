"use client";

import { BellRing, Check, ExternalLink, PenLine, Send } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { saveMailClient, saveOfferDescription } from "@/app/welcome/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canInstallChromeExtension,
  MAIL_CLIENTS,
  OFFER_DESCRIPTION_MAX,
  toolFor,
  type MailClient,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { IconRow, StepHeading } from "./parts";

type DailyT = ReturnType<typeof useTranslations<"onboarding.daily">>;

export function DailyStep({
  askOffer,
  initialMailClient,
  connected,
  chromeStoreUrl,
}: {
  askOffer: boolean;
  initialMailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  chromeStoreUrl: string | null;
}) {
  const t = useTranslations("onboarding.daily");
  return (
    <div className="space-y-10">
      <StepHeading
        title={t("title")}
        lead={t("lead")}
      />
      <ol className="space-y-6">
        <IconRow icon={Send} title={t("sendTitle")}>
          {t("sendBody")}
        </IconRow>
        <IconRow icon={BellRing} title={t("alertTitle")}>
          {t("alertBody")}
        </IconRow>
        <IconRow icon={PenLine} title={t("approveTitle")}>
          {t("approveBody")}
        </IconRow>
      </ol>
      <MailClientQuestion
        initial={initialMailClient}
        connected={connected}
        chromeStoreUrl={chromeStoreUrl}
      />
      {askOffer && <OfferField />}
    </div>
  );
}

/** Optional: lets the seller know whether there is something to plug into their mailbox, today or later. */
function MailClientQuestion({
  initial,
  connected,
  chromeStoreUrl,
}: {
  initial: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  chromeStoreUrl: string | null;
}) {
  const t = useTranslations("onboarding.daily");
  const tClients = useTranslations("onboarding.mailClients");
  // Guessed from the email domain until the seller picks: only a pick is saved
  const [value, setValue] = useState(initial);

  function pick(client: MailClient) {
    setValue(client);
    void saveMailClient(client);
  }

  return (
    <div className="space-y-3">
      <p className="text-small font-medium">
        {t("mailQuestion")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
      </p>
      <div role="radiogroup" aria-label={t("mailboxAria")} className="flex flex-wrap gap-2">
        {MAIL_CLIENTS.map((client) => (
          <button
            key={client}
            type="button"
            role="radio"
            aria-checked={value === client}
            onClick={() => pick(client)}
            className={cn(
              "rounded-sm border border-border bg-card px-3 py-1.5 text-small transition-colors duration-150 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30",
              value === client && "border-foreground bg-foreground font-medium text-background hover:bg-foreground",
            )}
          >
            {tClients(`${client}.title`)}
          </button>
        ))}
      </div>
      {value && toolFor(value) === "chrome" && chromeStoreUrl && !connected.chrome ? (
        <ExtensionOffer mailbox={value === "gmail" ? "Gmail" : "Outlook"} storeUrl={chromeStoreUrl} />
      ) : (
        value && <p className="text-small text-muted-foreground">{mailToolHint(t, value, connected, chromeStoreUrl)}</p>
      )}
    </div>
  );
}

function mailToolHint(
  t: DailyT,
  client: MailClient | null,
  connected: { chrome: boolean; outlook: boolean },
  chromeStoreUrl: string | null,
): React.ReactNode {
  const tool = toolFor(client);
  if (tool === "manual") return t("hintManual");
  if ((tool === "chrome" && connected.chrome) || (tool === "outlook_addin" && connected.outlook)) {
    return t("hintConnected");
  }
  if (tool === "chrome" && !chromeStoreUrl) {
    return t("hintSoon");
  }
  return t.rich("hintInstall", {
    link: (chunks) => (
      <Link href="/welcome?step=tool" className="text-foreground underline underline-offset-4">
        {chunks}
      </Link>
    ),
  });
}

const noSubscribe = () => () => {};

/** Gmail or Outlook on the web, store live, not paired yet: the extension is worth a real offer. Still optional. */
function ExtensionOffer({ mailbox, storeUrl }: { mailbox: string; storeUrl: string }) {
  const t = useTranslations("onboarding.daily");
  // The user agent only exists in the browser: say nothing about it on the server
  const canInstall = useSyncExternalStore(
    noSubscribe,
    () => canInstallChromeExtension(navigator.userAgent),
    () => null,
  );

  return (
    <div className="space-y-3 border border-foreground bg-card px-4 py-4">
      <p className="font-semibold">
        {t("extensionTitle", { mailbox })}{" "}
        <span className="font-normal text-muted-foreground">{t("optional")}</span>
      </p>
      <p className="text-small text-muted-foreground">{t("extensionBody")}</p>
      {canInstall === true && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={storeUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "default" })}>
            {t("addToChrome")}
            <ExternalLink />
          </a>
          <Link href="/welcome?step=tool" className="text-small underline underline-offset-4">
            {t("thenConnect")}
          </Link>
        </div>
      )}
      {canInstall === false && (
        <p className="text-small">{t("desktopOnly")}</p>
      )}
    </div>
  );
}

function OfferField() {
  const t = useTranslations("onboarding.daily");
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveOfferDescription(value);
      if (result.ok) setSaved(true);
      else toast.error(t("offerSaveFailed"));
    });
  }

  if (saved) {
    return (
      <p className="flex items-center gap-2 text-body text-muted-foreground">
        <Check className="size-4 text-success" aria-hidden />
        {t("offerSaved")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="offer">
        {t("offerLabel")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
      </Label>
      <Textarea
        id="offer"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={OFFER_DESCRIPTION_MAX}
        rows={3}
        placeholder={t("offerPlaceholder")}
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-small text-muted-foreground">
          {t("offerHint")}
        </p>
        <Button variant="outline" size="sm" disabled={pending || !value.trim()} onClick={save}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
