"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { LinkLiveState } from "@/lib/closing/live";
import { cn } from "cn";

const POLL_INTERVAL_MS = 5_000;

const DEVICE_LABELS: Record<string, string> = {
  mobile: "sur mobile",
  tablet: "sur tablette",
  desktop: "sur ordinateur",
};

/**
 * Polls the link's live state. Shows who is reading right now and re-renders
 * the server page as soon as new reading data, a follow-up or an alert lands,
 * so the seller never has to reload. Key it by `initial.stamp` so a server
 * re-render resets it.
 */
export function LiveActivity({
  linkId,
  initial,
  pageCount,
}: {
  linkId: string;
  initial: LinkLiveState;
  /** Null for web documents, which have no pages. */
  pageCount: number | null;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const stampRef = useRef(initial.stamp);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const poll = async () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/links/${linkId}/live`, { cache: "no-store" });
          if (res.ok) {
            const next = (await res.json()) as LinkLiveState;
            if (stopped) return;
            setState(next);
            if (next.stamp !== stampRef.current) {
              stampRef.current = next.stamp;
              router.refresh();
            }
          }
        } catch {
          // Offline or deploy in progress: try again on the next tick
        }
      }
      if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [linkId, router]);

  const { readers } = state;

  if (readers.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-1.5 rounded-full bg-foreground/25" />
        Personne ne lit en ce moment. La page se met à jour toute seule.
      </p>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-card px-4 py-3 ring-1 ring-heat-hot/40"
    >
      <span className="flex items-center gap-2.5 text-[15px] font-medium">
        <LiveDot />
        {readers.length === 1 ? "En train de lire" : `${readers.length} lecteurs en ce moment`}
      </span>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {readers.map((reader) => (
          <li key={reader.viewId}>
            <span className="font-medium">{reader.name ?? "Lecteur anonyme"}</span>
            <span className="text-muted-foreground">
              {[
                pageCount && reader.currentPage
                  ? `page ${reader.currentPage} sur ${pageCount}`
                  : null,
                reader.deviceType ? DEVICE_LABELS[reader.deviceType] : null,
              ]
                .filter(Boolean)
                .map((part) => `, ${part}`)
                .join("")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2.5", className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-heat-hot opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2.5 rounded-full bg-heat-hot" />
    </span>
  );
}
