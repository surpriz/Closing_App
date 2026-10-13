"use client";

import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

import { onboardingTestStatus, type TestLinkStatus } from "@/app/bienvenue/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { StepHeading } from "./parts";

const POLL_MS = 3000;

export function TestStep({
  testLink,
  onRead,
}: {
  testLink: { linkId: string; url: string } | null;
  onRead: () => void;
}) {
  const status = useTestStatus(testLink?.linkId ?? null);
  const read = status?.read ?? null;
  const notifyRead = useEffectEvent(onRead);
  const hasRead = !!read;
  useEffect(() => {
    if (hasRead) notifyRead();
  }, [hasRead]);

  return (
    <div className="space-y-8">
      <StepHeading
        title="Ouvrez-le comme votre prospect"
        lead="Voici le lien que votre prospect recevra. Ouvrez-le et feuilletez quelques pages, puis revenez ici."
      />

      {!testLink || !status?.ready ? (
        <p className="flex items-center gap-2 text-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          On prépare votre document…
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <a
              href={testLink.url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "lg", variant: read ? "outline" : "default" }))}
            >
              <ExternalLink />
              Ouvrir comme mon prospect
            </a>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(testLink.url)
                  .then(() => toast.success("Lien copié. Ouvrez-le sur votre téléphone, par exemple."))
              }
            >
              <Copy />
              Copier le lien
            </Button>
          </div>
          <p className="text-small text-muted-foreground">
            Ce lien de test ne compte pas dans vos statistiques et ne déclenche aucune relance.
          </p>
        </div>
      )}

      {read ? (
        <div className="animate-rise space-y-2 rounded-xl bg-success/10 px-5 py-4">
          <p className="flex items-center gap-2 font-medium">
            <Check className="size-4 text-success" aria-hidden />
            Votre document vient d&apos;être ouvert.
          </p>
          <p className="text-body">
            {read.pages > 1 ? `Lu jusqu'à la page ${read.pages}` : "Première page ouverte"}
            {read.seconds > 0 && `, ${formatSeconds(read.seconds)} de lecture`}.
          </p>
          <p className="text-body text-muted-foreground">
            C&apos;est ce que vous verrez quand votre prospect l&apos;ouvrira, en direct. Et Clozer vous dira quand le
            relancer.
          </p>
        </div>
      ) : (
        testLink &&
        status?.ready && (
          <p className="flex items-center gap-2 text-small text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-foreground/40" aria-hidden />
            En attente de votre lecture…
          </p>
        )
      )}
    </div>
  );
}

function useTestStatus(linkId: string | null) {
  const [status, setStatus] = useState<TestLinkStatus | null>(null);

  useEffect(() => {
    if (!linkId) return;
    let stopped = false;
    async function poll() {
      const next = await onboardingTestStatus(linkId!).catch(() => null);
      if (!stopped && next) setStatus(next);
    }
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [linkId]);

  return status;
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${String(seconds % 60).padStart(2, "0")}`;
}
