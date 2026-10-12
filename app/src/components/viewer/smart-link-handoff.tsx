"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import type { SmartParams } from "@/lib/closing/shared/smart-params";

type Props = { slug: string; reader: SmartParams; label: string };

/**
 * A Smart Link reader: identified from the URL once this runs in a browser,
 * then on to their own link. The address leaves the URL and the history.
 * Refused (a scanner, the seller): the plain gate.
 */
export function SmartLinkHandoff({ slug, reader, label }: Props) {
  // Once per page: a second POST from the dev double effect would make a second reader link
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`/api/v/${slug}/smart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: reader.email,
        company: reader.company ?? undefined,
        name: reader.name ?? undefined,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((result: { slug?: string } | null) => {
        window.location.replace(result?.slug ? `/v/${result.slug}` : `/v/${slug}?email=1`);
      });
  }, [slug, reader.email, reader.company, reader.name]);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <p role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {label}
      </p>
    </main>
  );
}
