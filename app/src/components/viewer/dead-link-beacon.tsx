"use client";

import { useEffect, useRef } from "react";

import { DEAD_OPEN_DWELL_MS, DEAD_OPEN_MIN_MS } from "@/lib/closing/revival";

type Props = { slug: string; disarmed: boolean };

/**
 * Tells the seller someone came back to this dead link: when the reader leaves
 * or after a while on the page, never on load. A scanner runs no script, and a
 * glance shorter than DEAD_OPEN_MIN_MS is not someone reading.
 */
export function DeadLinkBeacon({ slug, disarmed }: Props) {
  // Once per page: the dev double effect would send twice
  const sent = useRef(false);
  const off = useRef(disarmed);
  useEffect(() => {
    off.current = disarmed;
  }, [disarmed]);

  useEffect(() => {
    const openedAt = Date.now();
    const send = () => {
      if (sent.current || off.current || Date.now() - openedAt < DEAD_OPEN_MIN_MS) return;
      sent.current = true;
      const url = `/api/v/${slug}/dead-open`;
      if (!navigator.sendBeacon?.(url)) fetch(url, { method: "POST", keepalive: true }).catch(() => null);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };
    const timer = window.setTimeout(send, DEAD_OPEN_DWELL_MS);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
    };
  }, [slug]);

  return null;
}
