"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  IDLE_TIMEOUT_MS,
  TRACKING_FLUSH_INTERVAL_MS,
} from "@/lib/closing/constants";
import type { TrackingBatch, TrackingEvent } from "@/lib/closing/types";

type Pending = { ms: number; depth: number };

// One start request per slug per page load, even with StrictMode double effects
const startRequests = new Map<string, Promise<string | null>>();

function startView(slug: string) {
  let request = startRequests.get(slug);
  if (!request) {
    request = fetch("/api/track/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { viewId?: string } | null) => data?.viewId ?? null)
      .catch(() => null);
    startRequests.set(slug, request);
  }
  return request;
}

// Counts visible, active reading time per page and reports it every ~10s
export function usePageTracking(slug: string, pageCount: number) {
  const [currentPage, setCurrentPage] = useState(1);
  const viewIdRef = useRef<string | null>(null);
  const currentPageRef = useRef(1);
  const elementsRef = useRef(new Map<number, HTMLElement>());
  const pendingRef = useRef(new Map<number, Pending>());
  const lastInteractionRef = useRef(0);

  const registerPage = useCallback((pageNumber: number, element: HTMLElement | null) => {
    if (element) elementsRef.current.set(pageNumber, element);
    else elementsRef.current.delete(pageNumber);
  }, []);

  const getViewId = useCallback(() => viewIdRef.current, []);

  const flush = useCallback((useBeacon: boolean) => {
    const viewId = viewIdRef.current;
    const pending = pendingRef.current;
    if (!viewId || pending.size === 0) return;

    const events: TrackingEvent[] = [...pending.entries()]
      .filter(([, value]) => value.ms >= 250)
      .map(([pageNumber, value]) => ({
        pageNumber,
        durationMs: Math.round(value.ms),
        scrollDepth: Math.round(value.depth * 100) / 100,
      }));
    pending.clear();
    if (events.length === 0) return;

    const body = JSON.stringify({ viewId, events } satisfies TrackingBatch);
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pageCount) return;
    let cancelled = false;
    startView(slug).then((viewId) => {
      if (!cancelled) viewIdRef.current = viewId;
    });
    return () => {
      cancelled = true;
    };
  }, [slug, pageCount]);

  // Current page = the page occupying the most vertical space on screen
  useEffect(() => {
    if (!pageCount) return;
    const visibleHeights = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page);
          visibleHeights.set(page, entry.isIntersecting ? entry.intersectionRect.height : 0);
        }
        let best = currentPageRef.current;
        let bestHeight = -1;
        for (const [page, height] of visibleHeights) {
          if (height > bestHeight) {
            best = page;
            bestHeight = height;
          }
        }
        if (best !== currentPageRef.current) {
          currentPageRef.current = best;
          setCurrentPage(best);
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    elementsRef.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pageCount]);

  useEffect(() => {
    if (!pageCount) return;

    const markActive = () => {
      lastInteractionRef.current = Date.now();
    };
    const activityEvents = ["scroll", "mousemove", "keydown", "touchstart", "wheel", "click"] as const;
    activityEvents.forEach((name) => window.addEventListener(name, markActive, { passive: true }));

    let lastTick = Date.now();
    lastInteractionRef.current = lastTick;
    const tick = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(now - lastTick, 2000);
      lastTick = now;

      if (document.visibilityState !== "visible") return;
      if (now - lastInteractionRef.current > IDLE_TIMEOUT_MS) return;

      const page = currentPageRef.current;
      const entry = pendingRef.current.get(page) ?? { ms: 0, depth: 0 };
      entry.ms += delta;

      const element = elementsRef.current.get(page);
      if (element) {
        const rect = element.getBoundingClientRect();
        const seen = (window.innerHeight - rect.top) / rect.height;
        entry.depth = Math.max(entry.depth, Math.min(1, Math.max(0, seen)));
      }
      pendingRef.current.set(page, entry);
    }, 1000);

    const flushTimer = setInterval(() => flush(false), TRACKING_FLUSH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      activityEvents.forEach((name) => window.removeEventListener(name, markActive));
      clearInterval(tick);
      clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [pageCount, flush]);

  return { currentPage, registerPage, getViewId };
}
