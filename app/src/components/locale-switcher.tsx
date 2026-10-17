"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLocaleAction } from "@/app/locale-actions";
import { UI_LOCALES, type UiLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

// Each language is named in itself, so it reads the same whatever the current one.
const NAMES: Record<UiLocale, string> = { en: "English", fr: "Français" };

export function LocaleSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label="Language / Langue" className={cn("inline-flex ring-1 ring-foreground/85", className)}>
      {UI_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocaleAction(locale);
              router.refresh();
            })
          }
          className={cn(
            "px-3 py-1.5 text-small transition-colors",
            locale === current ? "bg-foreground text-background" : "hover:bg-muted",
          )}
        >
          {NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
