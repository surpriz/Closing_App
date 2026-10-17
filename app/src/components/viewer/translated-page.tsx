"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SupportedLocale } from "@/lib/closing/constants";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import type { PageSize } from "./pdf-viewer";
import { useTranslatedPart } from "./use-translation";

type Props = {
  slug: string;
  locale: SupportedLocale;
  pageNumber: number;
  size: PageSize;
  labels: ViewerLabels;
  /** The page as drawn from the PDF: shown for a page with no text, or when the translation failed. */
  original: React.ReactNode;
  overlay?: React.ReactNode;
  corner?: React.ReactNode;
  onTranslated: () => void;
};

/**
 * A PDF page in the reader's language, as text: the layout of the original
 * cannot be kept. Asked when the page comes close to the screen, like the
 * drawing of the original.
 */
export function TranslatedPdfPage({ slug, locale, pageNumber, size, labels, original, overlay, corner, onTranslated }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const state = useTranslatedPart(slug, locale, pageNumber, nearViewport, onTranslated);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (state?.status === "done" && !state.content) return original;
  if (state?.status === "failed") {
    return (
      <div className="space-y-2">
        <p role="status" className="px-2 text-small text-muted-foreground">
          {labels.translationFailed}
        </p>
        {original}
      </div>
    );
  }

  const loading = state?.status !== "done";
  return (
    <div
      ref={ref}
      lang={locale}
      className="group/page relative w-full bg-white px-5 py-6 text-black ring-1 ring-border sm:px-10 sm:py-9"
      // Keeps about the room of the page while it loads, so the scroll does not jump
      style={loading ? { aspectRatio: `${size.width} / ${size.height}` } : undefined}
    >
      {overlay && <div className="relative z-[1] mb-4">{overlay}</div>}
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-small text-neutral-500">
          <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
          {labels.translating}
        </p>
      ) : (
        <div className="text-body leading-relaxed whitespace-pre-line text-pretty">{state.content}</div>
      )}
      <span aria-hidden className="mt-6 block text-right font-mono text-micro text-neutral-400 tabular-nums">
        {pageNumber}
      </span>
      {corner}
    </div>
  );
}
