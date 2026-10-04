"use client";

import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { DealStatus } from "@/generated/prisma/enums";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { CtaBar } from "./cta-bar";
import { PrivacyNotice } from "./privacy-notice";
import { usePageTracking } from "./use-page-tracking";

type Props = {
  slug: string;
  documentName: string;
  externalUrl: string;
  /** Null when the site refuses to be framed: the prospect opens it in a new tab. */
  embedUrl: string | null;
  labels: ViewerLabels;
  ctaEnabled: boolean;
  dealStatus: DealStatus;
};

// URL documents (Notion, Loom, Figma...) are tracked as a single page
export function WebViewer({ slug, documentName, externalUrl, embedUrl, labels, ctaEnabled, dealStatus }: Props) {
  const { getViewId } = usePageTracking(slug, 1, { embedded: true, countTime: !!embedUrl });

  return (
    <div className="flex h-dvh flex-col bg-muted">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
          <h1 className="truncate text-sm font-medium">{documentName}</h1>
          {embedUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">{labels.openExternal}</span>
            </a>
          )}
        </div>
      </header>

      <main className={`flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2 sm:px-4 ${ctaEnabled ? "pb-24" : "pb-2"}`}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={documentName}
            className="mx-auto min-h-0 w-full max-w-6xl flex-1 rounded-sm bg-white shadow-md ring-1 ring-border"
            allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="max-w-md space-y-1.5">
              <p className="text-lg font-medium tracking-[-0.01em]">{labels.externalTitle}</p>
              <p className="text-sm text-muted-foreground">{labels.externalDescription}</p>
            </div>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "lg" })}
            >
              <ExternalLink />
              {labels.openExternal}
            </a>
          </div>
        )}
        <PrivacyNotice labels={labels} web className="px-2 text-center" />
      </main>

      {ctaEnabled && <CtaBar slug={slug} labels={labels} initialStatus={dealStatus} getViewId={getViewId} />}
    </div>
  );
}
