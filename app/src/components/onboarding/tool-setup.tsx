"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { saveMailClient } from "@/app/welcome/actions";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import type { MailClient } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { InstallStep } from "./install-step";
import { MailStep } from "./mail-step";

/**
 * /welcome?step=tool: plugging Clozer into the mailbox, outside the tour
 * (share screen tip, settings, the tour's last step).
 */
export function ToolSetup({
  firstName,
  initialMailClient,
  connected,
  account,
  chromeStoreUrl,
}: {
  firstName: string | null;
  initialMailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  account: { email: string; workspace: string };
  chromeStoreUrl: string | null;
}) {
  const t = useTranslations("onboarding.toolSetup");
  const [mailClient, setMailClient] = useState(initialMailClient);
  const [choosing, setChoosing] = useState(!initialMailClient);

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          {t("dashboard")}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <div key={choosing ? "mail" : "install"} className="animate-rise">
          {choosing ? (
            <MailStep firstName={firstName} value={mailClient} onChange={setMailClient} />
          ) : (
            <InstallStep
              mailClient={mailClient}
              connected={connected}
              account={account}
              chromeStoreUrl={chromeStoreUrl}
              onChangeMailClient={() => setChoosing(true)}
            />
          )}
        </div>
        <footer className="mt-12 flex items-center justify-between gap-4 border-t border-foreground pt-6">
          {!choosing && (
            <Button variant="ghost" onClick={() => setChoosing(true)}>
              <ArrowLeft />
              {t("changeMailbox")}
            </Button>
          )}
          {choosing ? (
            <Button
              size="lg"
              className="ml-auto"
              disabled={!mailClient}
              onClick={() => {
                if (mailClient) void saveMailClient(mailClient);
                setChoosing(false);
              }}
            >
              {t("continue")}
            </Button>
          ) : (
            <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "ml-auto")}>
              {t("done")}
            </Link>
          )}
        </footer>
      </main>
    </div>
  );
}
