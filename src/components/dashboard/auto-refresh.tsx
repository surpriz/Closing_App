"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the server page periodically, e.g. while a document is processed
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
