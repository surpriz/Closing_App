"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = { slug: string; token: string; label: string };

/**
 * Someone a reader forwarded the link to: identified from the email's token
 * once this runs in a browser, then on to the document. The token leaves the
 * URL and the history. Refused (a scanner, the seller, a stale token): the
 * plain gate.
 */
export function ForwardHandoff({ slug, token, label }: Props) {
  // Once per page: the dev double effect would post twice
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`/api/v/${slug}/forwarded`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .catch(() => null)
      .then(() => window.location.replace(`/v/${slug}`));
  }, [slug, token]);

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4">
      <p role="status" className="flex items-center gap-3 text-body text-muted-foreground">
        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
        {label}
      </p>
    </main>
  );
}
