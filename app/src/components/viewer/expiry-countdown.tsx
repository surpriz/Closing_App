"use client";

import { Hourglass } from "lucide-react";

import { formatCountdown } from "@/lib/closing/expiry";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { useExpiryRemaining } from "./expiry-gate";

/** "{time}" in a label, filled with the time left. Null outside an expiring link. */
function useCountdown(labels: ViewerLabels) {
  const remaining = useExpiryRemaining();
  return remaining === null ? null : formatCountdown(remaining, labels.countdownUnits);
}

/** On the pricing page of a quote: how long the price still holds. */
export function ExpiryBanner({ labels }: { labels: ViewerLabels }) {
  const time = useCountdown(labels);
  if (time === null) return null;

  return (
    <p
      role="timer"
      aria-live="off"
      className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-foreground/90 px-3.5 py-1.5 text-xs font-medium text-background shadow-lg backdrop-blur-sm sm:text-sm"
    >
      <Hourglass className="size-3.5 shrink-0" aria-hidden />
      <span className="text-pretty">{labels.expiryCountdown.replace("{time}", time)}</span>
    </p>
  );
}

/** In the header, when there is no pricing page to put the banner on. */
export function ExpiryChip({ labels }: { labels: ViewerLabels }) {
  const time = useCountdown(labels);
  if (time === null) return null;

  return (
    <span
      role="timer"
      aria-live="off"
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background tabular-nums"
    >
      <Hourglass className="size-3 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{labels.expiryChip.replace("{time}", time)}</span>
      <span className="sm:hidden">{time}</span>
    </span>
  );
}
