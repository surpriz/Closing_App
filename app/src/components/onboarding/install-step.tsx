"use client";

import { Check, Download, ExternalLink, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, useTransition } from "react";

import { OutlookConnect } from "@/components/dashboard/outlook-connect";
import { OutlookManifestLink } from "@/components/dashboard/outlook-manifest-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { canInstallChromeExtension, toolFor, type MailClient } from "@/lib/onboarding";

import { Instructions, StepHeading } from "./parts";

type Props = {
  mailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  account: { email: string; workspace: string };
  chromeStoreUrl: string | null;
  onChangeMailClient: () => void;
};

export function InstallStep(props: Props) {
  const tool = toolFor(props.mailClient);
  if (tool === "chrome") return <ChromeInstall {...props} />;
  if (tool === "outlook_addin") return <OutlookInstall {...props} />;
  return <ManualSend onChangeMailClient={props.onChangeMailClient} />;
}

function Connected({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 border-y border-foreground bg-card px-4 py-3 text-body font-medium">
      <Check className="size-4 text-success" aria-hidden />
      {children}
    </p>
  );
}

// The extension can't be seen from this page: its token in the database is the only proof
function CheckAgain() {
  const t = useTranslations("onboarding.install");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {t("checkAgain")}
    </Button>
  );
}

const noSubscribe = () => () => {};

function ChromeInstall({ mailClient, connected, chromeStoreUrl }: Props) {
  const t = useTranslations("onboarding.install");
  const mailbox = mailClient === "gmail" ? "Gmail" : "Outlook";
  // Assume a capable browser on the server, the page is mostly opened from one
  const canInstall = useSyncExternalStore(
    noSubscribe,
    () => canInstallChromeExtension(navigator.userAgent),
    () => true,
  );
  return (
    <div className="space-y-8">
      <StepHeading
        title={t("chromeTitle")}
        lead={t("chromeLead", { mailbox })}
      />
      {connected.chrome ? (
        <Connected>{t("chromeConnected")}</Connected>
      ) : (
        <Instructions
          items={[
            {
              text: chromeStoreUrl
                ? canInstall
                  ? t("installFromStore")
                  : t("openInChrome")
                : t("comingSoon"),
              extra: chromeStoreUrl && canInstall && (
                <a
                  href={chromeStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "default" })}
                >
                  {t("addToChrome")}
                  <ExternalLink />
                </a>
              ),
            },
            {
              text: t("pin"),
            },
            {
              text: t("tryIt", { mailbox }),
              extra: <CheckAgain />,
            },
          ]}
        />
      )}
    </div>
  );
}

function OutlookInstall({ connected, account }: Props) {
  const t = useTranslations("onboarding.install");
  return (
    <div className="space-y-8">
      <StepHeading
        title={t("outlookTitle")}
        lead={t("outlookLead")}
      />
      {connected.outlook ? (
        <Connected>{t("outlookConnected")}</Connected>
      ) : (
        <Instructions
          items={[
            {
              text: t("download"),
              extra: (
                <OutlookManifestLink className={buttonVariants({ variant: "outline" })}>
                  <Download />
                  clozer-outlook.xml
                </OutlookManifestLink>
              ),
            },
            {
              text: t.rich("addFromFile", { b: (chunks) => <strong>{chunks}</strong> }),
            },
            { text: t("openEmail") },
            {
              text: t("enterCode"),
              extra: (
                <OutlookConnect
                  account={account}
                  doneHint={t("outlookDone")}
                />
              ),
            },
          ]}
        />
      )}
      <p className="text-small text-muted-foreground">{t("itDeploy")}</p>
    </div>
  );
}

function ManualSend({ onChangeMailClient }: Pick<Props, "onChangeMailClient">) {
  const t = useTranslations("onboarding.install");
  return (
    <div className="space-y-8">
      <StepHeading
        title={t("manualTitle")}
        lead={t("manualLead")}
      />
      <Instructions
        items={[
          { text: t("manual1") },
          { text: t("manual2") },
          { text: t("manual3") },
        ]}
      />
      <p className="text-small text-muted-foreground">
        {t.rich("alsoUse", {
          change: (chunks) => (
            <button type="button" onClick={onChangeMailClient} className="underline underline-offset-4">
              {chunks}
            </button>
          ),
        })}
      </p>
    </div>
  );
}
