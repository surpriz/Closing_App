"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import type { DealStatus } from "@/generated/prisma/enums";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { CtaBar } from "./cta-bar";
import { PrivacyNotice } from "./privacy-notice";
import { usePageTracking } from "./use-page-tracking";
import { ViewerHeader } from "./viewer-header";

export type PageSize = { width: number; height: number };

type Props = {
  slug: string;
  fileUrl: string;
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
  ctaEnabled: boolean;
  dealStatus: DealStatus;
};

export function PdfViewer({ slug, fileUrl, documentName, senderName, labels, ctaEnabled, dealStatus }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [failed, setFailed] = useState(false);
  const { currentPage, registerPage, getViewId } = usePageTracking(slug, sizes.length);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // copied to /public by scripts/copy-pdf-worker.mjs
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        loadingTask = pdfjs.getDocument({ url: fileUrl, disableRange: true });
        const loaded = await loadingTask.promise;
        const pageSizes: PageSize[] = [];
        for (let i = 1; i <= loaded.numPages; i++) {
          const viewport = (await loaded.getPage(i)).getViewport({ scale: 1 });
          pageSizes.push({ width: viewport.width, height: viewport.height });
        }
        if (!cancelled) {
          setPdf(loaded);
          setSizes(pageSizes);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [fileUrl]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/60">
      <ViewerHeader
        documentName={documentName}
        senderName={senderName}
        labels={labels}
        progress={sizes.length > 0 ? currentPage / sizes.length : undefined}
        aside={
          sizes.length > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground tabular-nums">
              {currentPage} / {sizes.length}
              <span className="sr-only">
                {" "}
                {labels.page} {currentPage} {labels.of} {sizes.length}
              </span>
            </span>
          )
        }
      />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-2 py-4 pb-40 sm:space-y-6 sm:px-4 sm:py-8">
        {failed && <p className="py-24 text-center text-sm text-muted-foreground">{labels.loadError}</p>}
        {!failed && !pdf && (
          <div role="status" aria-label={labels.loading} className="space-y-4 sm:space-y-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="aspect-[1/1.414] w-full animate-pulse rounded-sm bg-card shadow-md ring-1 ring-border"
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
            />
          ))}
        {/* Also shown here because the email gate is optional per link */}
        <PrivacyNotice labels={labels} className="px-2 pt-2 text-center" />
      </main>

      {ctaEnabled && pdf && (
        <CtaBar
          slug={slug}
          labels={labels}
          initialStatus={dealStatus}
          getViewId={getViewId}
          documentName={documentName}
          atEnd={sizes.length > 0 && currentPage >= sizes.length}
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
};

// Also used by the seller's preview, which passes no registerPage (no tracking)
export function PdfPage({ pdf, pageNumber, size, registerPage }: PdfPageProps) {
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
      className="relative w-full overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-border"
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}
