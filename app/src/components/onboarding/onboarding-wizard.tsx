"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  completeOnboarding,
  createOnboardingTestLink,
  startOnboarding,
} from "@/app/welcome/actions";
import { Logo } from "@/components/brand/logo";
import type { AddedSource } from "@/components/dashboard/upload-dropzone";
import { Button } from "@/components/ui/button";
import {
  ONBOARDING_STEPS,
  type MailClient,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { DailyStep } from "./daily-step";
import { DropStep } from "./drop-step";
import { TestStep } from "./test-step";

const LAST = ONBOARDING_STEPS.length - 1;

export function OnboardingWizard({
  firstName,
  initialMailClient,
  connected,
  askOffer,
  uploadPrefix,
  chromeStoreUrl,
}: {
  firstName: string | null;
  initialMailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  askOffer: boolean;
  uploadPrefix: string;
  chromeStoreUrl: string | null;
}) {
  const t = useTranslations("onboarding.wizard");
  const tSteps = useTranslations("onboarding.steps");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState<AddedSource | null>(null);
  const [testLink, setTestLink] = useState<{
    linkId: string;
    url: string;
  } | null>(null);
  const [testRead, setTestRead] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const step = ONBOARDING_STEPS[index];

  useEffect(() => {
    void startOnboarding();
  }, []);

  // Reaching the end is enough: the seller has seen everything
  useEffect(() => {
    if (index === LAST) void completeOnboarding();
  }, [index]);

  function go(to: number) {
    setIndex(Math.max(0, Math.min(LAST, to)));
    window.scrollTo({ top: 0 });
  }

  async function onDocument(source: AddedSource) {
    setAdded(source);
    setTestLink(null);
    setTestRead(false);
    go(ONBOARDING_STEPS.indexOf("test"));
    const result = await createOnboardingTestLink(source.documentId);
    if ("error" in result) toast.error(result.error);
    else setTestLink(result);
  }

  function leave(to: string) {
    startLeaving(async () => {
      await completeOnboarding();
      router.push(to);
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-foreground">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo />
          {index < LAST && (
            <Button
              variant="ghost"
              size="sm"
              disabled={leaving}
              onClick={() => leave("/dashboard")}
            >
              {t("skip")}
            </Button>
          )}
        </div>
      </header>

      {/* One continuous sheet: the steps live in the margin column, the work on the page. */}
      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 px-4 sm:px-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          aria-label={t("stepsAria")}
          className="border-foreground py-5 md:border-r md:py-12 md:pr-6"
        >
          <ol className="flex gap-4 md:sticky md:top-12 md:flex-col md:gap-0">
            {ONBOARDING_STEPS.map((key, i) => (
              <li
                key={key}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "flex items-baseline gap-2 text-small md:border-b md:border-border md:py-3",
                  i === index
                    ? "font-semibold text-foreground"
                    : i < index
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                <span className="font-mono">
                  {i + 1}/{ONBOARDING_STEPS.length}
                </span>
                <span className={cn(i !== index && "max-md:hidden")}>
                  {tSteps(key)}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 pt-4 pb-16 md:pt-12 md:pl-10">
          <div key={step} className="animate-rise">
            {step === "drop" && (
              <DropStep
                firstName={firstName}
                uploadPrefix={uploadPrefix}
                onCreated={(source) => void onDocument(source)}
              />
            )}
            {step === "test" && (
              <TestStep testLink={testLink} onRead={() => setTestRead(true)} />
            )}
            {step === "daily" && (
              <DailyStep
                askOffer={askOffer}
                initialMailClient={initialMailClient}
                connected={connected}
                chromeStoreUrl={chromeStoreUrl}
              />
            )}
          </div>

          {/* Nothing to go back to or on with before a document is in: no empty footer rule. */}
          {(index > 0 || added) && (
            <footer className="mt-12 flex items-center justify-between gap-4 border-t border-foreground pt-6">
              {index > 0 && (
                <Button variant="ghost" onClick={() => go(index - 1)}>
                  <ArrowLeft />
                  {t("back")}
                </Button>
              )}
              {step === "drop" && added && (
                <Button
                  size="lg"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => go(index + 1)}
                >
                  {t("continueWithDocument")}
                  <ArrowRight />
                </Button>
              )}
              {step === "test" && (
                <Button
                  size="lg"
                  variant={testRead ? "default" : "ghost"}
                  className="ml-auto"
                  onClick={() => go(index + 1)}
                >
                  {testRead ? t("continue") : t("skipStep")}
                  <ArrowRight />
                </Button>
              )}
              {step === "daily" && (
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  {added && (
                    <Button
                      size="lg"
                      variant="ghost"
                      disabled={leaving}
                      onClick={() => leave("/dashboard")}
                    >
                      {t("dashboard")}
                    </Button>
                  )}
                  <Button
                    size="lg"
                    disabled={leaving}
                    onClick={() =>
                      leave(
                        added ? `/links/${added.linkId}?new=1` : "/dashboard",
                      )
                    }
                  >
                    {added ? t("sendToProspect") : t("goToDashboard")}
                    <ArrowRight />
                  </Button>
                </div>
              )}
            </footer>
          )}
        </div>
      </main>
    </div>
  );
}
