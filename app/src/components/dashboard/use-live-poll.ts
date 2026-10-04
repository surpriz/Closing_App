"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 5_000;

/**
 * Polls a live endpoint every 5 s while the tab is visible, and re-renders the
 * server page when its stamp changes, so the seller never has to reload.
 * Key the calling component by `initial.stamp` so a server re-render resets it.
 */
export function useLivePoll<T extends { stamp: string }>(url: string, initial: T): T {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const stampRef = useRef(initial.stamp);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    // The tab coming back while a request is out must not start a second loop.
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            const next = (await res.json()) as T;
            if (stopped) return;
            setState(next);
            if (next.stamp !== stampRef.current) {
              stampRef.current = next.stamp;
              router.refresh();
            }
          }
        } catch {
          // Network hiccup: the next tick retries.
        }
      }
      inFlight = false;
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
  }, [url, router]);

  return state;
}
