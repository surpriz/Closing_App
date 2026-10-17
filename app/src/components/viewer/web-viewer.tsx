"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { DealStatus } from "@/generated/prisma/enums";
import { playerSrc, videoProvider } from "@/lib/closing/documents/web-link";
import type { BookingTarget } from "@/lib/closing/booking/url";
import type { SupportedLocale } from "@/lib/closing/constants";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { ChatWidget, type ChatWidgetData } from "./chat-widget";
import { CapsuleBubble, type ViewerCapsule } from "./capsule-bubble";
import { CtaBar } from "./cta-bar";
import { ExpiryChip } from "./expiry-countdown";
import { PrivacyNotice } from "./privacy-notice";
import { ReaderArticle } from "./reader-article";
import { usePageTracking } from "./use-page-tracking";
import { useVideoProgress } from "./use-video-progress";
import { sendSignal } from "./view-signal";
import { ViewerHeader } from "./viewer-header";
import type { ForwardOptions } from "./forward-dialog";

type Props = {
  slug: string;
  documentName: string;
  senderName: string | null;
  externalUrl: string;
  /** Null when the site refuses to be framed: its article is shown instead, or it opens in a new tab. */
  embedUrl: string | null;
  /** The article of a site that refuses framing, cleaned on our side. */
  readerHtml: string | null;
  labels: ViewerLabels;
  ctaEnabled: boolean;
  /** The reader's name when known, offered when they sign. */
  signerName: string | null;
  booking: BookingTarget | null;
  /** "Transférer" to a colleague, null when not offered. */
  forward: ForwardOptions | null;
  dealStatus: DealStatus;
  locale: SupportedLocale;
  /** Null when the assistant is off for this link. */
  chat: ChatWidgetData | null;
  /** Quotes with a deadline: no pages here, the countdown goes in the header. */
  countdown?: boolean;
  /** The seller's welcome message, if any: a web page has no pages to hang clips on. */
  welcome: ViewerCapsule | null;
};

// URL documents (Notion, Loom, Figma...) are tracked as a single page
export function WebViewer({
  slug,
  documentName,
  senderName,
  externalUrl,
  embedUrl,
  readerHtml,
  labels,
  ctaEnabled,
  signerName,
  booking,
  forward,
  dealStatus,
  locale,
  chat,
  countdown,
  welcome,
}: Props) {
  const provider = videoProvider(embedUrl);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Share of the video watched, reported as the depth of the only page
  const watchedRef = useRef(0);
  // The article is read here like a PDF page: real scroll, real depth
  const reader = !embedUrl && !!readerHtml;
  const { getViewId, markActive, registerPage } = usePageTracking(slug, 1, {
    embedded: !reader,
    countTime: !!embedUrl || reader,
    depthRef: provider ? watchedRef : undefined,
  });
  useVideoProgress(iframeRef, provider, watchedRef, markActive);
  const openExternal = useExternalVisit(getViewId);
  // The bottom bar carries the answers, the booking button, or both
  const barVisible = ctaEnabled || !!booking || !!forward;
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div
      className={`flex flex-col bg-background selection:bg-foreground/15 selection:text-foreground ${reader ? "min-h-dvh" : "h-dvh"}`}
    >
      <ViewerHeader
        className="shrink-0"
        kind="web"
        documentName={documentName}
        senderName={senderName}
        labels={labels}
        aside={
          <>
            {countdown && <ExpiryChip labels={labels} />}
            {(embedUrl || reader) && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openExternal}
                aria-label={labels.openExternal}
                className={buttonVariants({ variant: "ghost", size: "sm", className: "h-11 min-w-11 px-2 sm:h-8 sm:min-w-0" })}
              >
                <ExternalLink />
                <span className="hidden sm:inline">{labels.openExternal}</span>
              </a>
            )}
          </>
        }
      />

      <main
        className={`flex min-h-0 flex-1 flex-col gap-3 px-2 pt-2 sm:px-4 sm:pt-4 ${barVisible ? "pb-[calc(var(--decision-bar-h,4rem)+0.75rem)]" : chat ? "pb-20" : "pb-3"}`}
      >
        {!embedUrl && readerHtml ? (
          <ReaderArticle
            ref={(element) => registerPage(1, element)}
            html={readerHtml}
            title={documentName}
            sourceLabel={labels.readerSource}
            externalUrl={externalUrl}
            onOpen={openExternal}
          />
        ) : embedUrl ? (
          <iframe
            ref={iframeRef}
            src={playerSrc(embedUrl)}
            title={documentName}
            className="mx-auto min-h-0 w-full max-w-6xl flex-1 bg-white ring-1 ring-border"
            allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-2">
            <div className="w-full max-w-md border-y border-foreground py-6">
              <p className="text-heading">{labels.externalTitle}</p>
              <p className="mt-1.5 text-body text-pretty text-muted-foreground">{labels.externalDescription}</p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openExternal}
                className={buttonVariants({ size: "xl", className: "mt-6 w-full justify-between" })}
              >
                {labels.openExternal}
                <ExternalLink data-icon="inline-end" />
              </a>
            </div>
          </div>
        )}
        <PrivacyNotice labels={labels} web className="mx-auto px-2 text-center" />
      </main>

      {barVisible && (
        <CtaBar
          slug={slug}
          labels={labels}
          initialStatus={dealStatus}
          getViewId={getViewId}
          documentName={documentName}
          signerName={signerName}
          answers={ctaEnabled}
          booking={booking}
          onAskQuestion={chat ? () => setChatOpen(true) : undefined}
          forward={forward}
        />
      )}

      <CapsuleBubble
        capsule={welcome}
        slug={slug}
        labels={labels}
        senderName={senderName}
        getViewId={getViewId}
        sheetOpen={chatOpen}
      />

      {chat && (
        <ChatWidget
          {...chat}
          slug={slug}
          labels={labels}
          locale={locale}
          senderName={senderName}
          getViewId={getViewId}
          open={chatOpen}
          onOpenChange={setChatOpen}
          launcher={barVisible ? "docked" : "floating"}
        />
      )}
    </div>
  );
}

/**
 * The site itself opens in another tab, out of sight. We record the click,
 * then how long the reader stayed away before coming back to this tab: a
 * rough measure of the time spent on the site.
 */
function useExternalVisit(getViewId: () => string | null) {
  const leftAtRef = useRef<number | null>(null);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || leftAtRef.current === null) return;
      sendSignal(getViewId(), "EXTERNAL_RETURN", Date.now() - leftAtRef.current);
      leftAtRef.current = null;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [getViewId]);

  return () => {
    sendSignal(getViewId(), "EXTERNAL_OPEN");
    leftAtRef.current = Date.now();
  };
}
