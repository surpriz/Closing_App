"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  completeOnboarding,
  createOnboardingTestLink,
  startOnboarding,
} from "@/app/welcome/actions";
import { Logo } from "@/components/brand/logo";
import { LocaleMenu } from "@/components/dashboard/locale-menu";
import type { AddedSource } from "@/components/dashboard/upload-dropzone";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STEPS, type MailClient } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { DailyStep } from "./daily-step";
import { DropStep } from "./drop-step";
import { TestStep } from "./test-step";

const LAST = ONBOARDING_STEPS.length - 1;

type TestLink = { linkId: string; url: string };

/**
 * Drop a document, read it as the prospect, plug the mailbox in (the Chrome
 * extension or the Outlook add-in), then send for real.
 */
export function OnboardingWizard({
  firstName,
  uploadPrefix,
  previous,
  initialMailClient,
  connected,
  chromeStoreUrl,
  askOffer,
}: {
  firstName: string | null;
  uploadPrefix: string;
  initialMailClient: MailClient | null;
  connected: { chrome: boolean; outlook: boolean };
  chromeStoreUrl: string | null;
  /** A manager whose workspace has no offer yet: the last step asks for one line. */
  askOffer: boolean;
  /** Replaying the tour: the latest document, so it is not added again. */
  previous: { documentId: string; linkId: string | null; name: string } | null;
}) {
  const t = useTranslations("onboarding.wizard");
  const tSteps = useTranslations("onboarding.steps");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState<AddedSource | null>(null);
  const [testLink, setTestLink] = useState<TestLink | null>(null);
  const [testError, setTestError] = useState(false);
  const [testRead, setTestRead] = useState(false);
  const [documentFailed, setDocumentFailed] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const step = ONBOARDING_STEPS[index];

  // The document the latest test link was asked for: an older answer arriving late is dropped
  const asked = useRef<string | null>(null);

  useEffect(() => {
    void startOnboarding();
  }, []);

  // Reaching the last step counts as done too: the seller has seen everything
  useEffect(() => {
    if (index === LAST) void completeOnboarding();
  }, [index]);

  function go(to: number) {
    setIndex(Math.max(0, Math.min(LAST, to)));
    window.scrollTo({ top: 0 });
  }

  async function makeTestLink(documentId: string) {
    asked.current = documentId;
    setTestError(false);
    const result = await createOnboardingTestLink(documentId).catch(() => null);
    if (asked.current !== documentId) return;
    if (!result || "error" in result) setTestError(true);
    else setTestLink(result);
  }

  // Reading the test also counts as done (the last step does too, above)
  function onTestRead() {
    setTestRead(true);
    void completeOnboarding();
  }

  async function onDocument(source: AddedSource) {
    setAdded(source);
    setTestLink(null);
    setTestRead(false);
    setDocumentFailed(false);
    go(ONBOARDING_STEPS.indexOf("test"));
    await makeTestLink(source.documentId);
  }

  // Back to the first step for another document: the sample, or one that could not be read
  function dropAnother() {
    asked.current = null;
    setAdded(null);
    setTestLink(null);
    setTestError(false);
    setTestRead(false);
    setDocumentFailed(false);
    go(0);
  }

  function leave(to: string) {
    startLeaving(async () => {
      await completeOnboarding();
      router.push(to);
    });
  }

  // The one way on from the test: the real share screen, or the seller's own document after the sample
  const sendTo = added?.linkId
    ? `/links/${added.linkId}?new=1`
    : added
      ? `/documents/${added.documentId}`
      : "/dashboard";
  const restart = !!added?.sample;
  const finalLabel = added?.sample ? t("ownDocument") : added ? t("sendToProspect") : t("goToDashboard");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-foreground">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <LocaleMenu />
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
                previous={previous}
                onCreated={(source) => void onDocument(source)}
              />
            )}
            {step === "test" && (
              <TestStep
                testLink={testLink}
                failed={testError}
                onRetry={() => added && void makeTestLink(added.documentId)}
                onRead={onTestRead}
                onDocumentFailed={() => setDocumentFailed(true)}
              />
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
                  // A document that could not be read: start over with another, else on to the mailbox
                  variant={testRead || documentFailed ? "default" : "ghost"}
                  className="ml-auto"
                  onClick={() => (documentFailed ? dropAnother() : go(index + 1))}
                >
                  {documentFailed ? t("otherDocument") : testRead ? t("continue") : t("skipStep")}
                  <ArrowRight />
                </Button>
              )}
              {step === "daily" && (
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  {added && (
                    <Button size="lg" variant="link" disabled={leaving} onClick={() => leave("/dashboard")}>
                      {t("dashboard")}
                    </Button>
                  )}
                  <Button
                    size="lg"
                    disabled={leaving}
                    // After the sample: the seller's own document; else the real share screen
                    onClick={() => (restart ? dropAnother() : leave(sendTo))}
                  >
                    {finalLabel}
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
