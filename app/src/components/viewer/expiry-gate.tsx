"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { countdownTickMs } from "@/lib/closing/expiry";

/** Milliseconds left, or null outside an expiring link. */
const ExpiryContext = createContext<number | null>(null);

export function useExpiryRemaining() {
  return useContext(ExpiryContext);
}

type Props = {
  /** ISO dates from the server: the countdown runs on its clock, not the reader's. */
  expiresAt: string;
  serverNow: string;
  /** Rendered by the server, shown the moment the time runs out. */
  locked: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Keeps the time left for the whole viewer and swaps it for the locked screen
 * at zero, without waiting for a reload. The server then confirms with a
 * refresh: if its clock says otherwise, the new props restart the countdown.
 */
export function ExpiryGate({ expiresAt, serverNow, locked, children }: Props) {
  const router = useRouter();
  const initial = new Date(expiresAt).getTime() - new Date(serverNow).getTime();
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    // Same starting point as the server render, then the reader's clock only measures elapsed time
    const deadline = Date.now() + initial;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const left = deadline - Date.now();
      setRemaining(left);
      if (left > 0) timer = setTimeout(tick, Math.min(countdownTickMs(left), left));
    };
    tick();
    return () => clearTimeout(timer);
  }, [initial]);

  const expired = remaining <= 0;
  useEffect(() => {
    if (!expired) return;
    const timer = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(timer);
  }, [expired, router]);

  if (expired) return locked;
  return <ExpiryContext.Provider value={remaining}>{children}</ExpiryContext.Provider>;
}
