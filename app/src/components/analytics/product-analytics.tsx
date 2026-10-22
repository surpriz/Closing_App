"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { isProspectPath, loadAnalytics } from "@/lib/analytics/client";

/** Pageviews of the seller side. Skipped on prospect pages, where PostHog is not even downloaded. */
export function ProductAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isProspectPath(pathname)) void loadAnalytics();
  }, [pathname]);
  return null;
}

/** Ties this page load to the seller's account: an id only, never the email or the name. */
export function IdentifySeller({ userId }: { userId: string }) {
  useEffect(() => {
    void loadAnalytics().then((posthog) => posthog?.identify(userId));
  }, [userId]);
  return null;
}
