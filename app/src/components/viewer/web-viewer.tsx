"use client";

import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { DealStatus } from "@/generated/prisma/enums";
import type { SupportedLocale } from "@/lib/closing/constants";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { ChatWidget, type ChatWidgetData } from "./chat-widget";
import { CtaBar } from "./cta-bar";
import { ExpiryChip } from "./expiry-countdown";
import { PrivacyNotice } from "./privacy-notice";
import { usePageTracking } from "./use-page-tracking";
import { ViewerHeader } from "./viewer-header";

type Props = {
  slug: string;
  documentName: string;
  senderName: string | null;
  externalUrl: string;
  /** Null when the site refuses to be framed: the prospect opens it in a new tab. */
  embedUrl: string | null;
  labels: ViewerLabels;
  ctaEnabled: boolean;
  dealStatus: DealStatus;
  locale: SupportedLocale;
  /** Null when the assistant is off for this link. */
  chat: ChatWidgetData | null;
  /** Quotes with a deadline: no pages here, the countdown goes in the header. */
  countdown?: boolean;
};

// URL documents (Notion, Loom, Figma...) are tracked as a single page
export function WebViewer({
  slug,
  documentName,
  senderName,
  externalUrl,
  embedUrl,
  labels,
  ctaEnabled,
  dealStatus,
  locale,
  chat,
  countdown,
}: Props) {
  const { getViewId } = usePageTracking(slug, 1, { embedded: true, countTime: !!embedUrl });

  return (
    <div className="flex h-dvh flex-col bg-muted/60">
      <ViewerHeader
        className="shrink-0"
        documentName={documentName}
        senderName={senderName}
        labels={labels}
        aside={
          <>
            {countdown && <ExpiryChip labels={labels} />}
            {embedUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={labels.openExternal}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <ExternalLink />
                <span className="hidden sm:inline">{labels.openExternal}</span>
              </a>
            )}
          </>
        }
      />

      <main className={`flex min-h-0 flex-1 flex-col gap-2 px-2 pt-2 sm:px-4 ${ctaEnabled ? "pb-36 sm:pb-24" : chat ? "pb-20" : "pb-2"}`}>
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

      {ctaEnabled && (
        <CtaBar
          slug={slug}
          labels={labels}
          initialStatus={dealStatus}
          getViewId={getViewId}
          documentName={documentName}
        />
      )}

      {chat && (
        <ChatWidget
          {...chat}
          slug={slug}
          labels={labels}
          locale={locale}
          senderName={senderName}
          getViewId={getViewId}
          ctaVisible={ctaEnabled}
        />
      )}
    </div>
  );
}
