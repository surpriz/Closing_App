"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import type { DealStatus } from "@/generated/prisma/enums";
import type { BookingTarget } from "@/lib/closing/booking/url";
import type { SupportedLocale } from "@/lib/closing/constants";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { WELCOME_PAGE } from "@/lib/closing/capsules/resolve";

import { CapsuleBubble, type ViewerCapsule } from "./capsule-bubble";
import { ChatWidget, type ChatWidgetData } from "./chat-widget";
import { CtaBar } from "./cta-bar";
import { ExpiryBanner, ExpiryChip } from "./expiry-countdown";
import { PrivacyNotice } from "./privacy-notice";
import { LanguageMenu, TranslationStrip } from "./translation-controls";
import { usePageTracking } from "./use-page-tracking";
import { useTranslatedFile, useViewerTranslation, type ViewerTranslation } from "./use-translation";
import { ViewerHeader } from "./viewer-header";
import { VoiceCommentButton, VoiceCommentPanel } from "./voice-comment-button";
import type { ForwardOptions } from "./forward-dialog";

export type PageSize = { width: number; height: number };

type Props = {
  slug: string;
  fileUrl: string;
  documentName: string;
  senderName: string | null;
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
  /** Quotes with a deadline: the countdown sits on these pages, or in the header when there are none. */
  countdown?: { pricingPages: number[] } | null;
  /** Pages tagged as pricing: reaching one (or the last page) opens the decision strip. */
  decisionPages?: number[];
  /** Seller clips, at most one per page. */
  capsules: ViewerCapsule[];
  /** The prospect may record a voice comment on a page. */
  voiceComments: boolean;
  /** Null when the document cannot be translated: the menu then only changes the labels. */
  translation: ViewerTranslation | null;
};

export function PdfViewer({
  slug,
  fileUrl,
  documentName,
  senderName,
  labels,
  ctaEnabled,
  signerName,
  booking,
  forward,
  dealStatus,
  locale,
  chat,
  countdown,
  decisionPages = [],
  capsules,
  voiceComments,
  translation,
}: Props) {
  // Which file it was loaded from: switching to the translation destroys the previous one
  const [loaded, setLoaded] = useState<{ pdf: PDFDocumentProxy; url: string } | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  // A translated file that does not open leaves "Show original" to get back to reading
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { currentPage, registerPage, getViewId } = usePageTracking(slug, sizes.length);
  const translated = useViewerTranslation(translation, getViewId);
  const translatedFile = useTranslatedFile(slug, translated.locale, translated.onTranslated);
  // The translated PDF replaces the original once ready: same pages, same tracking, same capsules
  const shownUrl = translatedFile?.status === "done" ? `${fileUrl}?lang=${translated.locale}` : fileUrl;
  const pdf = loaded?.url === shownUrl ? loaded.pdf : null;
  const failed = failedUrl === shownUrl;
  // The bottom bar carries the answers, the booking button, or both
  const barVisible = ctaEnabled || !!booking || !!forward;
  // Once the reader has seen the price or the last page, the strip stays open
  const [decisionReached, setDecisionReached] = useState(false);
  const atDecision = sizes.length > 0 && (currentPage >= sizes.length || decisionPages.includes(currentPage));
  if (atDecision && !decisionReached) setDecisionReached(true);
  // An open voice comment stays on its page while the reader scrolls
  const [voicePage, setVoicePage] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  // One sheet at a time at the bottom: the others step aside while it is open
  const sheetOpen = chatOpen || capsuleOpen || voicePage !== null;
  const voiceTrigger = (placement: "bar" | "corner") =>
    voiceComments && !sheetOpen ? (
      <VoiceCommentButton labels={labels} placement={placement} onClick={() => setVoicePage(currentPage)} />
    ) : undefined;

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // copied to /public by scripts/copy-pdf-worker.mjs
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        loadingTask = pdfjs.getDocument({ url: shownUrl, disableRange: true });
        const doc = await loadingTask.promise;
        const pageSizes: PageSize[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const viewport = (await doc.getPage(i)).getViewport({ scale: 1 });
          pageSizes.push({ width: viewport.width, height: viewport.height });
        }
        if (!cancelled) {
          setLoaded({ pdf: doc, url: shownUrl });
          setSizes(pageSizes);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setFailedUrl(shownUrl);
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [shownUrl]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background selection:bg-foreground/15 selection:text-foreground">
      <ViewerHeader
        documentName={documentName}
        senderName={senderName}
        labels={labels}
        progress={sizes.length > 0 ? currentPage / sizes.length : undefined}
        below={
          <TranslationStrip
            labels={labels}
            locale={locale}
            source={translation?.source ?? null}
            target={translated.target}
            showOriginal={translated.showOriginal}
            onToggleOriginal={translated.toggleOriginal}
            status={translatedFile?.status === "pending" ? "loading" : translatedFile?.status === "failed" ? "failed" : null}
            offer={translated.offer}
            pending={translated.pending}
            onAccept={translated.choose}
            onDismiss={translated.dismissOffer}
          />
        }
        aside={
          <>
            {countdown && countdown.pricingPages.length === 0 && <ExpiryChip labels={labels} />}
            {sizes.length > 0 && (
              <span className="shrink-0 font-mono text-micro text-muted-foreground tabular-nums">
                <span aria-hidden>
                  P.{currentPage}/{sizes.length}
                </span>
                <span className="sr-only">
                  {" "}
                  {labels.page} {currentPage} {labels.of} {sizes.length}
                </span>
              </span>
            )}
            <LanguageMenu
              current={locale}
              source={translation?.source ?? null}
              labels={labels}
              pending={translated.pending}
              onChoose={translated.choose}
            />
          </>
        }
      />

      <main
        className={`mx-auto w-full max-w-4xl flex-1 space-y-3 px-2 pt-3 sm:space-y-5 sm:px-4 sm:pt-6 ${barVisible ? "pb-[calc(var(--decision-bar-h,4rem)+1.5rem)]" : "pb-8"}`}
      >
        {failed && (
          <p role="alert" className="py-24 text-center text-body text-muted-foreground">
            {labels.loadError}
          </p>
        )}
        {!failed && !pdf && (
          <div role="status" aria-label={labels.loading} className="space-y-4 sm:space-y-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="aspect-[1/1.414] w-full bg-card ring-1 ring-border motion-safe:animate-pulse"
              />
            ))}
          </div>
        )}
        {pdf &&
          sizes.map((size, index) => (
            <PdfPage
              key={index + 1}
              pdf={pdf}
              pageNumber={index + 1}
              size={size}
              registerPage={registerPage}
              overlay={countdown?.pricingPages.includes(index + 1) ? <ExpiryBanner labels={labels} /> : undefined}
              // With a bar, the mic sits in it; without, in the corner of the page on screen
              corner={!barVisible && index + 1 === currentPage ? voiceTrigger("corner") : undefined}
            />
          ))}
        {/* Also shown here because the email gate is optional per link */}
        <PrivacyNotice labels={labels} className="mx-auto border-t border-border px-2 pt-4 text-center" />
      </main>

      {barVisible && loaded && (
        <CtaBar
          slug={slug}
          labels={labels}
          initialStatus={dealStatus}
          getViewId={getViewId}
          documentName={documentName}
          signerName={signerName}
          answers={ctaEnabled}
          booking={booking}
          downloadUrl={`${fileUrl}?download=1`}
          atEnd={decisionReached}
          onAskQuestion={chat ? () => setChatOpen(true) : undefined}
          forward={forward}
          voice={voiceTrigger("bar")}
        />
      )}

      {voicePage !== null && (
        <VoiceCommentPanel
          slug={slug}
          pageNumber={voicePage}
          labels={labels}
          senderName={senderName}
          getViewId={getViewId}
          onClose={() => setVoicePage(null)}
        />
      )}

      {loaded && (
        <CapsuleBubble
          // A page's own clip on its page, the welcome message everywhere else
          capsule={
            capsules.find((c) => c.pageNumber === currentPage) ??
            capsules.find((c) => c.pageNumber === WELCOME_PAGE) ??
            null
          }
          slug={slug}
          labels={labels}
          senderName={senderName}
          getViewId={getViewId}
          sheetOpen={chatOpen || voicePage !== null}
          onOpenChange={setCapsuleOpen}
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
          open={chatOpen}
          onOpenChange={setChatOpen}
          launcher={barVisible && !!loaded ? "docked" : "floating"}
        />
      )}
    </div>
  );
}

type PdfPageProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  size: PageSize;
  registerPage?: (pageNumber: number, element: HTMLElement | null) => void;
  /** Drawn over the top of the page (the countdown on a pricing page). */
  overlay?: React.ReactNode;
  /** Drawn in the bottom right corner of the page (the voice comment button). */
  corner?: React.ReactNode;
};

// Also used by the seller's preview, which passes no registerPage (no tracking)
export function PdfPage({ pdf, pageNumber, size, registerPage, overlay, corner }: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [width, setWidth] = useState(0);

  // Only render pages close to the screen
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || !width) return;
    let task: RenderTask | null = null;
    let cancelled = false;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (width / page.getViewport({ scale: 1 }).width) * pixelRatio;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      task = page.render({ canvas, viewport });
      await task.promise.catch(() => {});
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, nearViewport, width]);

  return (
    <div
      ref={(element) => {
        containerRef.current = element;
        registerPage?.(pageNumber, element);
      }}
      data-page={pageNumber}
      className="group/page relative w-full overflow-hidden bg-white ring-1 ring-border"
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {overlay && <div className="absolute inset-x-2 top-2 z-[1] sm:top-3">{overlay}</div>}
      {corner}
    </div>
  );
}
