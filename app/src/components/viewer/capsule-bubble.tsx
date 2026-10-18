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
 * The seller's clip for the page the prospect reached: a small square still
 * bottom left, above the decision strip, the video downloaded only when
 * tapped open. Once closed, it stays closed.
 */
const noSubscribe = () => () => {};

export function CapsuleBubble({
  capsule,
  slug,
  labels,
  senderName,
  getViewId,
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
        className="fixed inset-x-0 bottom-0 z-50 flex animate-rise flex-col gap-3 border-t border-foreground bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg sm:inset-x-auto sm:bottom-[calc(var(--decision-bar-h,0px)+1rem)] sm:left-4 sm:z-40 sm:w-[340px] sm:rounded-lg sm:border-t-0 sm:ring-1 sm:ring-border"
      >
        <header className="flex items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-body font-semibold">{from}</p>
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
            className="aspect-square w-full rounded-sm bg-black object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <Avatar initials={initials} playing className="size-20 rounded-md text-title" />
            <audio ref={playerRef} src={open.src} controls className="w-full" />
          </div>
        )}
        {open.hookText && <p className="text-body text-muted-foreground">{open.hookText}</p>}
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
  onOpen: () => void;
  onDismiss: () => void;
};

/**
 * Fresh for a few seconds: the still with the hook text beside it. Then the
 * still alone, small enough to leave the strip and the page in peace.
 */
function Bubble({ capsule, from, initials, labels, onOpen, onDismiss }: BubbleProps) {
  const [fresh, setFresh] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setFresh(false), FRESH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "fixed left-3 z-30 flex animate-rise items-stretch overflow-hidden rounded-lg bg-card shadow-md ring-1 ring-border sm:left-4",
        // Above the decision strip, whose height it publishes; the screen's edge when there is none
        "bottom-[calc(var(--decision-bar-h,env(safe-area-inset-bottom))+0.75rem)]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${labels.capsuleOpen} · ${from}`}
        className={cn(
          "group relative shrink-0 overflow-hidden bg-foreground outline-none transition-[width,height] duration-300 ease-out-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          fresh ? "size-16" : "size-12",
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
          <Avatar initials={initials} playing={fresh} className={cn("size-full", fresh ? "text-heading" : "text-small")} />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/30">
          <Play className={cn("fill-white text-white", fresh ? "size-5" : "size-4")} aria-hidden />
        </span>
      </button>
      {/* Folded, the still keeps a way to close it: it would come back on every page with a clip */}
      {!fresh && (
        <Button
          variant="ghost"
          size="icon"
          className="h-auto w-11 shrink-0 rounded-none border-l border-border"
          onClick={onDismiss}
          aria-label={labels.capsuleDismiss}
        >
          <X />
        </Button>
      )}
      {fresh && (
        // Narrow enough to leave the chat launcher, bottom right, uncovered on a phone
        <div className="flex max-w-[min(15rem,calc(100vw-10rem))] items-center gap-1 border-l border-border py-1 pr-1 pl-3">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 rounded-sm py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block text-micro text-muted-foreground">{from}</span>
            <span className="line-clamp-2 text-small font-medium">{capsule.hookText ?? labels.capsuleOpen}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 sm:size-9"
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
        "relative flex items-center justify-center bg-foreground font-semibold text-background",
        className,
      )}
    >
      {initials}
      {playing && (
        <span className="absolute bottom-2 flex items-end gap-0.5" aria-hidden>
          {[0, 150, 300, 450].map((delay) => (
            <span
              key={delay}
              className="h-2 w-0.5 bg-background/80 motion-safe:animate-pulse"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
