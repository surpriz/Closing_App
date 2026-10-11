"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { completeOnboarding, saveMailClient } from "@/app/bienvenue/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  isToolConnected,
  ONBOARDING_STEPS,
  STEP_LABELS,
  toolFor,
  type MailClient,
  type OnboardingStep,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { InstallStep } from "./install-step";
import { MailStep } from "./mail-step";
import { StartStep } from "./start-step";

const LAST = ONBOARDING_STEPS.length - 1;

export function OnboardingWizard({
  firstName,
  account,
  initialMailClient,
  initialStep,
  connected,
  askOffer,
  hasDocument,
  uploadPrefix,
  chromeStoreUrl,
}: {
  firstName: string | null;
  account: { email: string; workspace: string };
  initialMailClient: MailClient | null;
  initialStep: OnboardingStep;
  connected: { chrome: boolean; outlook: boolean };
  askOffer: boolean;
  hasDocument: boolean;
  uploadPrefix: string;
  chromeStoreUrl: string | null;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(ONBOARDING_STEPS.indexOf(initialStep));
  const [mailClient, setMailClient] = useState(initialMailClient);
  const [leaving, startLeaving] = useTransition();
  const step = ONBOARDING_STEPS[index];

  // Reaching the end is enough: the upload there navigates away by itself
  useEffect(() => {
    if (index === LAST) void completeOnboarding();
  }, [index]);

  function go(to: number) {
    setIndex(Math.max(0, Math.min(LAST, to)));
    window.scrollTo({ top: 0 });
  }

  function next() {
    // Saved on the way out: the preselected guess counts once confirmed
    if (step === "mail" && mailClient) void saveMailClient(mailClient);
    go(index + 1);
  }

  function leave() {
    startLeaving(async () => {
      await completeOnboarding();
      router.push("/dashboard");
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        {index < LAST && (
          <Button variant="ghost" size="sm" disabled={leaving} onClick={leave}>
            Passer
          </Button>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <nav aria-label="Étapes" className="mb-10 sm:mb-14">
          <ol className="flex gap-1.5">
            {ONBOARDING_STEPS.map((key, i) => (
              <li key={key} className="flex-1 space-y-2">
                <span
                  aria-hidden
                  className={cn(
                    "block h-1 rounded-full transition-colors duration-300",
                    i <= index ? "bg-foreground" : "bg-foreground/[0.08]",
                  )}
                />
                <span
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "hidden text-small sm:block",
                    i === index ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {STEP_LABELS[key]}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <div key={step} className="animate-rise">
          {step === "mail" && <MailStep firstName={firstName} value={mailClient} onChange={setMailClient} />}
          {step === "install" && (
            <InstallStep
              mailClient={mailClient}
              connected={connected}
              account={account}
              chromeStoreUrl={chromeStoreUrl}
              onChangeMailClient={() => go(ONBOARDING_STEPS.indexOf("mail"))}
            />
          )}
          {step === "start" && <StartStep tool={toolFor(mailClient)} askOffer={askOffer} uploadPrefix={uploadPrefix} />}
        </div>

        <footer className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6">
          {index > 0 && (
            <Button variant="ghost" onClick={() => go(index - 1)}>
              <ArrowLeft />
              Retour
            </Button>
          )}
          {index < LAST ? (
            <Button size="lg" className="ml-auto" disabled={step === "mail" && !mailClient} onClick={next}>
              {step === "install" && !isToolConnected(mailClient, connected) ? "Plus tard, continuer" : "Continuer"}
              <ArrowRight />
            </Button>
          ) : (
            <Button
              size="lg"
              variant={hasDocument ? "default" : "outline"}
              className="ml-auto"
              disabled={leaving}
              onClick={leave}
            >
              {hasDocument ? "Aller au tableau de bord" : "Je le ferai plus tard"}
              <ArrowRight />
            </Button>
          )}
        </footer>
      </main>
    </div>
  );
}
