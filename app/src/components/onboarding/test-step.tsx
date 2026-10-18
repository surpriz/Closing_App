"use client";

import { Check, Copy, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { onboardingTestStatus, type TestLinkStatus } from "@/app/welcome/actions";
import { ThermalPlate } from "@/components/brand/thermal-plate";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { StepHeading } from "./parts";

const POLL_MS = 3000;
/** Past this, the wait gets a word: the seller may go on without testing. */
const SLOW_MS = 30_000;

export function TestStep({
  testLink,
  failed,
  onRetry,
  onRead,
  onDocumentFailed,
}: {
  testLink: { linkId: string; url: string } | null;
  /** The test link could not be made. */
  failed: boolean;
  onRetry: () => void;
  onRead: () => void;
  /** The document could not be read: the tour offers another one. */
  onDocumentFailed: () => void;
}) {
  const t = useTranslations("onboarding.test");
  const status = useTestStatus(testLink?.linkId ?? null);
  const read = status?.read ?? null;
  const notifyRead = useEffectEvent(onRead);
  const notifyFailed = useEffectEvent(onDocumentFailed);
  const hasRead = !!read;
  const documentFailed = !!status?.failed;
  const slow = useSlow(!failed && !documentFailed && !status?.ready);
  useEffect(() => {
    if (hasRead) notifyRead();
  }, [hasRead]);
  useEffect(() => {
    if (documentFailed) notifyFailed();
  }, [documentFailed]);

  return (
    <div className="space-y-8">
      <StepHeading
        title={t("title")}
        lead={
          <>
            {t("lead")} <span className="text-foreground">{t("notCounted")}</span>
          </>
        }
      />

      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-body">{t("linkFailed")}</p>
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw />
            {t("retry")}
          </Button>
        </div>
      ) : documentFailed ? (
        <p role="alert" className="text-body">
          {t("documentFailed")}
        </p>
      ) : !testLink || !status?.ready ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-body text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("preparing")}
          </p>
          {slow && <p className="text-small text-muted-foreground">{t("slow")}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <a
            href={testLink.url}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "lg", variant: read ? "outline" : "default" }))}
          >
            <ExternalLink />
            {t("openAsProspect")}
          </a>
          {/* Second screen: the seller reads on the phone and watches the pages heat up here */}
          <Button
            size="lg"
            variant="outline"
            onClick={() =>
              void navigator.clipboard
                .writeText(testLink.url)
                .then(() => toast.success(t("copied")))
            }
          >
            <Copy />
            {t("copyLink")}
          </Button>
        </div>
      )}

      {read ? (
        <figure className="animate-rise border border-foreground">
          <figcaption className="flex items-center gap-2 border-b border-foreground px-4 py-3 font-semibold">
            <Check className="size-4 text-success" aria-hidden />
            {t("opened")}
          </figcaption>
          <div className="grid grid-cols-6 gap-1 p-4 sm:grid-cols-8">
            {Array.from({ length: Math.min(8, Math.max(1, read.pages)) }, (_, i) => (
              <ThermalPlate key={i} heat={i === 0 ? 0.9 : 0.75 - i * 0.06} seed={i} className="aspect-[3/4]" />
            ))}
          </div>
          <div className="space-y-1 border-t border-border px-4 py-3">
            <p className="text-body">
              {read.pages > 1 ? t("readUpTo", { page: read.pages }) : t("firstPage")}
              {read.seconds > 0 && t("readTime", { duration: formatSeconds(read.seconds) })}.
            </p>
            <p className="text-body text-muted-foreground">{t("liveHint")}</p>
          </div>
        </figure>
      ) : (
        testLink &&
        status?.ready && (
          <p className="flex items-center gap-2 text-small text-muted-foreground">
            <span className="size-2 animate-pulse bg-iron-2" aria-hidden />
            {t("waiting")}
          </p>
        )
      )}
    </div>
  );
}

/** True once `waiting` has held for SLOW_MS; back to false as soon as it stops. */
function useSlow(waiting: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [waiting]);
  return waiting && slow;
}

function useTestStatus(linkId: string | null) {
  const [status, setStatus] = useState<TestLinkStatus | null>(null);

  useEffect(() => {
    if (!linkId) return;
    let stopped = false;
    let timer = 0;
    // Read, or given up on: nothing left to wait for, the polling stops
    function stop() {
      stopped = true;
      window.clearInterval(timer);
    }
    async function poll() {
      const next = await onboardingTestStatus(linkId!).catch(() => null);
      if (stopped || !next) return;
      setStatus(next);
      if (next.read || next.failed) stop();
    }
    void poll();
    timer = window.setInterval(() => void poll(), POLL_MS);
    return stop;
  }, [linkId]);

  return status;
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${String(seconds % 60).padStart(2, "0")}`;
}
