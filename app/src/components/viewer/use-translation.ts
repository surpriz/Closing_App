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

export type ArticleState = { status: "loading" } | { status: "done"; content: string } | { status: "failed" };
export type FileState = { status: "pending"; secondsRemaining: number | null } | { status: "done" } | { status: "failed" };

// Shared by the whole session: toggling back to the translation never asks twice
const articles = new Map<string, Promise<string>>();

function fetchArticle(slug: string, locale: SupportedLocale) {
  const key = `${slug}:${locale}`;
  let request = articles.get(key);
  if (!request) {
    request = fetch(`/api/v/${slug}/translation?lang=${locale}`).then(async (response) => {
      if (!response.ok) throw new Error(`translation ${response.status}`);
      return ((await response.json()) as { content: string }).content;
    });
    // A failure can be tried again later
    request.catch(() => articles.delete(key));
    articles.set(key, request);
  }
  return request;
}

/** The web article in the reader's language, translated by the AI. Null while the original is asked for. */
export function useTranslatedArticle(slug: string, locale: SupportedLocale | null, onDone: () => void): ArticleState | null {
  const [state, setState] = useState<{ locale: SupportedLocale; value: ArticleState } | null>(null);

  useEffect(() => {
    if (!locale) return;
    let cancelled = false;
    fetchArticle(slug, locale).then(
      (content) => {
        if (cancelled) return;
        setState({ locale, value: content ? { status: "done", content } : { status: "failed" } });
        if (content) onDone();
      },
      () => !cancelled && setState({ locale, value: { status: "failed" } }),
    );
    return () => {
      cancelled = true;
    };
  }, [slug, locale, onDone]);

  if (!locale) return null;
  return state?.locale === locale ? state.value : { status: "loading" };
}

const POLL_MIN_MS = 2000;
const POLL_MAX_MS = 10_000;

/**
 * The PDF in the reader's language, translated by DeepL with its layout. The
 * server moves the job forward each time it is asked: this asks again, sooner
 * when DeepL says it is nearly done, until the file is ready.
 */
export function useTranslatedFile(slug: string, locale: SupportedLocale | null, onDone: () => void): FileState | null {
  const [state, setState] = useState<{ locale: SupportedLocale; value: FileState } | null>(null);

  useEffect(() => {
    if (!locale) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      let next: FileState;
      try {
        const response = await fetch(`/api/v/${slug}/translation?lang=${locale}`);
        next = response.ok ? ((await response.json()) as FileState) : { status: "failed" };
      } catch {
        next = { status: "failed" };
      }
      if (cancelled) return;
      setState({ locale, value: next });
      if (next.status === "done") onDone();
      if (next.status !== "pending") return;
      const hint = (next.secondsRemaining ?? 0) * 1000;
      timer = setTimeout(ask, Math.min(POLL_MAX_MS, Math.max(POLL_MIN_MS, hint / 2)));
    };
    void ask();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, locale, onDone]);

  if (!locale) return null;
  return state?.locale === locale ? state.value : { status: "pending", secondsRemaining: null };
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
