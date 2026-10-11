"use client";

import { useEffect, useRef } from "react";

/** A reader leaving in the first seconds was not going to ask anything. */
const MIN_DWELL_MS = 20_000;

function alreadyShown(key: string) {
  try {
    return sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markShown(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {}
}

/**
 * Calls `onExit` once per tab session when the mouse leaves through the top
 * of the window, towards the tab bar or the close button. Mouse only: there
 * is no such gesture on a phone.
 */
export function useExitIntent(enabled: boolean, key: string, onExit: () => void) {
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  });

  useEffect(() => {
    if (!enabled || !window.matchMedia("(pointer: fine)").matches || alreadyShown(key)) return;
    const armedAt = Date.now() + MIN_DWELL_MS;
    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget || event.clientY > 0 || Date.now() < armedAt) return;
      document.removeEventListener("mouseout", onMouseOut);
      markShown(key);
      onExitRef.current();
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [enabled, key]);
}
