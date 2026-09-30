"use client";

import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";

import { PdfPage, type PageSize } from "@/components/viewer/pdf-viewer";

/** The seller's own view of a PDF document. Same rendering as the prospect's, without tracking. */
export function DocumentPreview({ fileUrl }: { fileUrl: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
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

  if (failed) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Impossible d&apos;afficher le PDF ici.{" "}
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-foreground underline">
          Ouvrir dans un nouvel onglet
        </a>
      </p>
    );
  }

  if (!pdf) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Chargement du PDF…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {sizes.map((size, index) => (
        <div key={index + 1} className="space-y-1.5">
          <PdfPage pdf={pdf} pageNumber={index + 1} size={size} />
          <p className="text-center text-xs text-muted-foreground tabular-nums">
            {index + 1} / {sizes.length}
          </p>
        </div>
      ))}
    </div>
  );
}
