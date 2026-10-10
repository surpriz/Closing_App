"use client";

import { Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CapsuleKind } from "@/generated/prisma/enums";
import { addDismissed, dismissalKey, parseDismissed } from "@/lib/closing/capsules/dismissal";
import { fillLabel, type ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

export type ViewerCapsule = {
  id: string;
  pageNumber: number;
  kind: CapsuleKind;
  hookText: string | null;
  src: string;
};

type Props = {
  /** The capsule of the page on screen, if any. */
  capsule: ViewerCapsule | null;
  slug: string;
  labels: ViewerLabels;
  senderName: string | null;
  getViewId: () => string | null;
  ctaVisible: boolean;
};

function readDismissed(slug: string) {
  if (typeof window === "undefined") return [];
  try {
    return parseDismissed(window.localStorage.getItem(dismissalKey(slug)));
  } catch {
    return [];
  }
}

/**
 * The seller's clip for the page the prospect reached: a round muted teaser
 * bottom left, opened with sound on a tap. Once closed, it stays closed.
 */
export function CapsuleBubble({ capsule, slug, labels, senderName, getViewId, ctaVisible }: Props) {
  // Rendered once the PDF has loaded, so always in the browser
  const [dismissed, setDismissed] = useState(() => readDismissed(slug));
  const [open, setOpen] = useState<ViewerCapsule | null>(null);
  const playerRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const counted = useRef(new Set<string>());

  const sender = senderName ?? labels.chatSenderFallback;
  const from = fillLabel(labels.capsuleFrom, { sender });
  const initials = sender
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const dismiss = (id: string) => {
    const next = addDismissed(dismissed, id);
    setDismissed(next);
    try {
      window.localStorage.setItem(dismissalKey(slug), JSON.stringify(next));
    } catch {
      // private mode: closed for this visit only
    }
  };

  const expand = (target: ViewerCapsule) => {
    setOpen(target);
    if (!counted.current.has(target.id)) {
      counted.current.add(target.id);
      void fetch(`/api/v/${slug}/capsules/${target.id}/play`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewId: getViewId() }),
      }).catch(() => {});
    }
  };

  const close = () => {
    if (open) dismiss(open.id);
    setOpen(null);
  };

  // iOS only plays with sound when play() follows the tap, so start as soon as the player mounts
  useEffect(() => {
    const player = playerRef.current;
    if (!open || !player) return;
    player.currentTime = 0;
    void player.play().catch(() => {});
  }, [open]);

  if (open) {
    return (
      <section
        role="dialog"
        aria-label={from}
        onKeyDown={(event) => event.key === "Escape" && close()}
        className="fixed inset-x-0 bottom-0 z-50 flex animate-rise flex-col gap-3 rounded-t-2xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl ring-1 ring-border sm:inset-x-auto sm:bottom-4 sm:left-4 sm:z-40 sm:w-[340px] sm:rounded-2xl"
      >
        <header className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{from}</p>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label={labels.capsuleClose} autoFocus>
            <X />
          </Button>
        </header>
        {open.kind === "VIDEO" ? (
          <video
            ref={playerRef}
            src={open.src}
            controls
            playsInline
            className="aspect-square w-full rounded-xl bg-black object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <Avatar initials={initials} playing className="size-20" />
            <audio ref={playerRef} src={open.src} controls className="w-full" />
          </div>
        )}
        {open.hookText && <p className="text-sm text-muted-foreground">{open.hookText}</p>}
      </section>
    );
  }

  if (!capsule || dismissed.includes(capsule.id)) return null;

  return (
    <div
      key={capsule.id}
      className={cn(
        "fixed left-4 z-30 flex animate-rise items-center gap-2",
        ctaVisible ? "bottom-[calc(7.5rem+env(safe-area-inset-bottom))] sm:bottom-24 lg:bottom-6" : "bottom-6",
      )}
    >
      <button
        type="button"
        onClick={() => expand(capsule)}
        aria-label={`${labels.capsuleOpen} · ${from}`}
        className="group relative size-16 shrink-0 overflow-hidden rounded-full bg-brand shadow-lg ring-4 ring-card outline-none focus-visible:ring-brand/40 sm:size-20"
      >
        {capsule.kind === "VIDEO" ? (
          <video
            src={capsule.src}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : (
          <Avatar initials={initials} playing className="size-full" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
          <Play className="size-6 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </span>
      </button>
      <div className="flex max-w-[min(15rem,calc(100vw-9rem))] items-start gap-1 rounded-2xl bg-card py-2 pr-1 pl-3 text-sm shadow-lg ring-1 ring-border">
        <button type="button" onClick={() => expand(capsule)} className="min-w-0 text-left">
          <span className="block text-xs text-muted-foreground">{from}</span>
          <span className="line-clamp-2">{capsule.hookText ?? labels.capsuleOpen}</span>
        </button>
        <Button variant="ghost" size="icon-xs" onClick={() => dismiss(capsule.id)} aria-label={labels.capsuleDismiss}>
          <X />
        </Button>
      </div>
    </div>
  );
}

function Avatar({ initials, playing, className }: { initials: string; playing?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "relative flex items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground",
        className,
      )}
    >
      {initials}
      {playing && (
        <span className="absolute bottom-2 flex items-end gap-0.5" aria-hidden>
          {[0, 150, 300, 450].map((delay) => (
            <span
              key={delay}
              className="h-2 w-0.5 rounded-full bg-brand-foreground/80 motion-safe:animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
