"use client";

import { Check, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { setLocaleAction } from "@/app/locale-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UI_LOCALES, type UiLocale } from "@/i18n/locale";

// Each language is named in itself, so it reads the same whatever the current one.
const NAMES: Record<UiLocale, string> = { en: "English", fr: "Français" };

/** Language choice, next to the theme in the account menu (the header keeps its globe too). */
export function LocaleMenuItems() {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("nav.userMenu");

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={current}
        onValueChange={(value) =>
          startTransition(async () => {
            await setLocaleAction(value as UiLocale);
            router.refresh();
          })
        }
      >
        {UI_LOCALES.map((locale) => (
          <DropdownMenuRadioItem key={locale} value={locale} lang={locale} disabled={pending}>
            {NAMES[locale]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

/** The language, always in sight in the header: a globe and "EN" / "FR". */
export function LocaleMenu() {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("nav.userMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("language")}
        title={t("language")}
        disabled={pending}
        className="flex h-9 items-center gap-1 rounded-md px-2 text-small font-semibold text-muted-foreground uppercase outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-muted aria-expanded:text-foreground"
      >
        <Globe className="size-5" aria-hidden />
        {current}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {UI_LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            lang={locale}
            onClick={() =>
              startTransition(async () => {
                await setLocaleAction(locale);
                router.refresh();
              })
            }
          >
            <Check className={locale === current ? "" : "invisible"} aria-hidden />
            {NAMES[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
