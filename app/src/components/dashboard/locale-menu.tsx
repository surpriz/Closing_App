"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { setLocaleAction } from "@/app/locale-actions";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { UI_LOCALES, type UiLocale } from "@/i18n/locale";

// Each language is named in itself, so it reads the same whatever the current one.
const NAMES: Record<UiLocale, string> = { en: "English", fr: "Français" };

/** Language choice, next to the theme in the account menu: set once, not worth a header slot. */
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
