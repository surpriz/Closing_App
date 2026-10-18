"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { saveMailClient } from "@/app/welcome/actions";
import { buttonVariants } from "@/components/ui/button";
import { canInstallChromeExtension, MAIL_CLIENTS, toolFor, type MailClient } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { StepHeading } from "./parts";

type DailyT = ReturnType<typeof useTranslations<"onboarding.daily">>;

/** The tour's last step: plug the mailbox in, so the next links go out without copy-paste. */
export function DailyStep({
  initialMailClient,
  connected,
  chromeStoreUrl,
}: {
  initialMailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  chromeStoreUrl: string | null;
}) {
  const t = useTranslations("onboarding.daily");
  return (
    <div className="space-y-10">
      <StepHeading title={t("title")} lead={t("lead")} />
      <MailClientQuestion initial={initialMailClient} connected={connected} chromeStoreUrl={chromeStoreUrl} />
    </div>
  );
}

/** Lets the seller know whether there is something to plug into their mailbox, today or later. */
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

/** Gmail or Outlook on the web, store live, not paired yet: the extension is worth a real offer. */
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
      {canInstall === false && <p className="text-small">{t("desktopOnly")}</p>}
    </div>
  );
}
