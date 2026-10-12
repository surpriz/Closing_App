"use client";

import { Play, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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
  /** Still frame of a video; null for audio and clips recorded before stills. */
  poster: string | null;
};

type Props = {
  /** The capsule of the page on screen, if any. */
  capsule: ViewerCapsule | null;
  slug: string;
  labels: ViewerLabels;
  senderName: string | null;
  getViewId: () => string | null;
  /** The call-to-action bar is at the bottom: the bubble sits above it. */
  ctaVisible: boolean;
  /** Another sheet (chat, voice note) is open: the bubble steps aside. */
  sheetOpen?: boolean;
  /** Tells the viewer when the clip itself is open or closed. */
  onOpenChange?: (open: boolean) => void;
};

/** How long the hook text stays next to the avatar before folding to the avatar alone. */
const FRESH_MS = 10_000;

function readDismissed(slug: string) {
  if (typeof window === "undefined") return [];
  try {
    return parseDismissed(window.localStorage.getItem(dismissalKey(slug)));
  } catch {
    return [];
  }
}

/**
 * The seller's clip for the page the prospect reached: a round still frame
 * bottom left, the video downloaded only when tapped open. Once closed, it
 * stays closed.
 */
const noSubscribe = () => () => {};

export function CapsuleBubble({
  capsule,
  slug,
  labels,
  senderName,
  getViewId,
  ctaVisible,
  sheetOpen = false,
  onOpenChange,
}: Props) {
  // Closed clips live in localStorage: render nothing on the server (the web viewer is server-rendered)
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
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
    onOpenChange?.(true);
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
    onOpenChange?.(false);
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
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:size-9"
            onClick={close}
            aria-label={labels.capsuleClose}
            autoFocus
          >
            <X />
          </Button>
        </header>
        {open.kind === "VIDEO" ? (
          <video
            ref={playerRef}
            src={open.src}
            poster={open.poster ?? undefined}
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

  if (!inBrowser || !capsule || sheetOpen || dismissed.includes(capsule.id)) return null;

  return (
    <Bubble
      // Remounted for each clip: the hook text shows fresh again, then folds
      key={capsule.id}
      capsule={capsule}
      from={from}
      initials={initials}
      labels={labels}
      ctaVisible={ctaVisible}
      onOpen={() => expand(capsule)}
      onDismiss={() => dismiss(capsule.id)}
    />
  );
}

type BubbleProps = {
  capsule: ViewerCapsule;
  from: string;
  initials: string;
  labels: ViewerLabels;
  ctaVisible: boolean;
  onOpen: () => void;
  onDismiss: () => void;
};

/**
 * Fresh for a few seconds: a big still with the hook text next to it. Then
 * the avatar alone, small enough to leave the bar and the page in peace.
 */
function Bubble({ capsule, from, initials, labels, ctaVisible, onOpen, onDismiss }: BubbleProps) {
  const [fresh, setFresh] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setFresh(false), FRESH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "fixed left-4 z-30 flex animate-rise items-center gap-2",
        ctaVisible ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      {/* A few pulses to catch the eye, then still */}
      {fresh && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 size-16 rounded-full bg-brand/40 motion-safe:animate-ping motion-safe:[animation-iteration-count:3] sm:size-20"
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${labels.capsuleOpen} · ${from}`}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-full bg-brand shadow-lg ring-card outline-none transition-[width,height] duration-300 focus-visible:ring-brand/40",
          fresh ? "size-16 ring-4 sm:size-20" : "size-11 ring-2 sm:size-14",
        )}
      >
        {/* No autoplaying teaser: it would download the whole clip for every reader, tap or not */}
        {capsule.kind === "VIDEO" && capsule.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route
          <img src={capsule.poster} alt="" className="size-full object-cover" />
        ) : capsule.kind === "VIDEO" ? (
          // Older clips without a still: the first frame, fetched as a small range
          <video src={`${capsule.src}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
        ) : (
          <Avatar initials={initials} playing={fresh} className={cn("size-full", !fresh && "text-sm")} />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
          <Play className={cn("fill-white text-white drop-shadow", fresh ? "size-6" : "size-4")} aria-hidden />
        </span>
      </button>
      {fresh && (
        <div className="flex max-w-[min(15rem,calc(100vw-9rem))] items-center gap-1 rounded-2xl bg-card py-1.5 pr-1 pl-3 text-sm shadow-lg ring-1 ring-border">
          <button type="button" onClick={onOpen} className="min-w-0 py-0.5 text-left">
            <span className="block text-xs text-muted-foreground">{from}</span>
            <span className="line-clamp-2">{capsule.hookText ?? labels.capsuleOpen}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:size-9"
            onClick={onDismiss}
            aria-label={labels.capsuleDismiss}
          >
            <X />
          </Button>
        </div>
      )}
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
