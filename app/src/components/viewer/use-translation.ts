"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { SupportedLocale } from "@/lib/closing/constants";
import { VIEWER_LOCALE_COOKIE, VIEWER_LOCALE_COOKIE_MAX_AGE } from "@/lib/closing/i18n/viewer";

import { sendSignal } from "./view-signal";

/** Set by the viewer page: null when the document cannot be translated (switched off, no AI, framed site). */
export type ViewerTranslation = {
  /** The document's language, when known. */
  source: string | null;
  /** The language the document is shown in. Null: the original. */
  target: SupportedLocale | null;
  /** The browser's language, offered when it is not the document's and the reader picked nothing yet. */
  offer: SupportedLocale | null;
};

export type PartState = { status: "loading" } | { status: "done"; content: string } | { status: "failed" };

// Shared by every page of the session: scrolling back or toggling never asks twice
const requests = new Map<string, Promise<string>>();

function fetchPart(slug: string, locale: SupportedLocale, page: number | null) {
  const query = new URLSearchParams({ lang: locale, ...(page !== null && { page: String(page) }) });
  const key = `${slug}?${query}`;
  let request = requests.get(key);
  if (!request) {
    request = fetch(`/api/v/${slug}/translation?${query}`).then(async (response) => {
      if (!response.ok) throw new Error(`translation ${response.status}`);
      return ((await response.json()) as { content: string }).content;
    });
    // A failure can be tried again on the next visit to the page
    request.catch(() => requests.delete(key));
    requests.set(key, request);
  }
  return request;
}

/** One part in the reader's language: a PDF page, or the web article (page null). Asked only once `enabled`. */
export function useTranslatedPart(
  slug: string,
  locale: SupportedLocale | null,
  page: number | null,
  enabled: boolean,
  onDone?: () => void,
): PartState | null {
  const [state, setState] = useState<{ key: string; value: PartState } | null>(null);
  const key = `${locale}:${page}`;

  useEffect(() => {
    if (!locale || !enabled) return;
    let cancelled = false;
    fetchPart(slug, locale, page).then(
      (content) => {
        if (cancelled) return;
        setState({ key, value: { status: "done", content } });
        if (content) onDone?.();
      },
      () => !cancelled && setState({ key, value: { status: "failed" } }),
    );
    return () => {
      cancelled = true;
    };
  }, [slug, locale, page, enabled, key, onDone]);

  if (!locale || !enabled) return null;
  return state?.key === key ? state.value : { status: "loading" };
}

/**
 * What the reader controls around a translated document: the language they
 * pick (kept in a cookie, the page renders again in it), whether they look at
 * the original for a moment, and the one signal telling the seller.
 */
export function useViewerTranslation(translation: ViewerTranslation | null, getViewId: () => string | null) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showOriginal, setShowOriginal] = useState(false);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const signalled = useRef<string | null>(null);
  const target = translation?.target ?? null;

  const choose = useCallback(
    (locale: SupportedLocale) => {
      document.cookie = `${VIEWER_LOCALE_COOKIE}=${locale}; path=/; max-age=${VIEWER_LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      setShowOriginal(false);
      startTransition(() => router.refresh());
    },
    [router],
  );

  // Once per language: the view can still be starting when the first page comes back
  const onTranslated = useCallback(() => {
    if (!target || signalled.current === target) return;
    signalled.current = target;
    let tries = 0;
    const send = () => {
      const viewId = getViewId();
      if (viewId) sendSignal(viewId, "TRANSLATED", undefined, target);
      else if (++tries < 5) setTimeout(send, 2000);
    };
    send();
  }, [target, getViewId]);

  return {
    /** The language parts are asked in, null while the original is shown. */
    locale: showOriginal ? null : target,
    target,
    showOriginal,
    toggleOriginal: () => setShowOriginal((value) => !value),
    offer: !target && !offerDismissed ? (translation?.offer ?? null) : null,
    dismissOffer: () => setOfferDismissed(true),
    choose,
    pending,
    onTranslated,
  };
}
