"use client";

import { Check, Globe, Languages, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/closing/constants";
import { fillLabel, labelsLocale, type ViewerLabels } from "@/lib/closing/i18n/viewer";
import { languageName } from "@/lib/closing/translation/translation";

const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

type MenuProps = {
  current: SupportedLocale;
  /** The document's language, tagged "original" in the list. */
  source: string | null;
  labels: ViewerLabels;
  pending: boolean;
  onChoose: (locale: SupportedLocale) => void;
};

/** The reader's language, in the header: each one named in itself, so it reads the same whatever the current one. */
export function LanguageMenu({ current, source, labels, pending, onChoose }: MenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.languageMenu}
        title={labels.languageMenu}
        disabled={pending}
        className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-small font-semibold text-muted-foreground uppercase outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-muted aria-expanded:text-foreground sm:h-8 sm:min-w-0"
      >
        <Globe className="size-4" aria-hidden />
        {current}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {SUPPORTED_LOCALES.map((locale) => (
          <DropdownMenuItem key={locale} lang={locale} onClick={() => locale !== current && onChoose(locale)}>
            <Check className={locale === current ? "" : "invisible"} aria-hidden />
            {capitalise(languageName(locale, locale))}
            {locale === source && (
              <span className="ml-auto text-micro text-muted-foreground">{labels.originalLanguage}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type StripProps = {
  labels: ViewerLabels;
  /** The language the labels are in, to name the others. */
  locale: SupportedLocale;
  source: string | null;
  /** Shown translated: the notice and the way back to the original. */
  target: SupportedLocale | null;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  /** How the translation goes: the whole document is swapped at once, PDF or web article. */
  status?: "loading" | "failed" | null;
  /** Not translated yet: the browser's language, offered once. */
  offer: SupportedLocale | null;
  pending: boolean;
  onAccept: (locale: SupportedLocale) => void;
  onDismiss: () => void;
};

/** A thin line under the header: offers the reader's language, or says the text is a machine translation. */
export function TranslationStrip({
  labels,
  locale,
  source,
  target,
  showOriginal,
  onToggleOriginal,
  status,
  offer,
  pending,
  onAccept,
  onDismiss,
}: StripProps) {
  if (!target && !(offer && source)) return null;
  // The first translation of a PDF takes a while: say so, or the reader clicks again and again
  const waiting = !!target && status === "loading" && !showOriginal;

  return (
    <div role="status" aria-live="polite" className="border-b border-border bg-card">
      <div
        className={`mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pr-2 pl-4 text-small sm:pr-3 ${waiting ? "text-foreground" : "text-muted-foreground"}`}
      >
        {waiting ? (
          <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
        ) : (
          <Languages className="size-4 shrink-0" aria-hidden />
        )}
        {target ? (
          <>
            <span className="min-w-0 flex-1 text-pretty">
              {waiting ? labels.translating : status === "failed" ? labels.translationFailed : labels.machineTranslated}
            </span>
            {status !== "failed" && !waiting && (
              <Button variant="ghost" size="sm" className="h-9 sm:h-7" onClick={onToggleOriginal}>
                {showOriginal ? labels.showTranslation : labels.showOriginal}
              </Button>
            )}
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              {fillLabel(labels.translationOffer, { language: languageName(source!, labelsLocale(locale)) })}
            </span>
            <Button size="sm" className="h-9 sm:h-7" disabled={pending} onClick={() => onAccept(offer!)}>
              {fillLabel(labels.translationAccept, { language: languageName(offer!, labelsLocale(locale)) })}
            </Button>
            <Button variant="ghost" size="sm" className="h-9 sm:h-7" onClick={onDismiss}>
              {labels.translationDismiss}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
