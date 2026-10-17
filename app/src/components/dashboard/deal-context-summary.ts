import type { useTranslations } from "next-intl";

import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";

type SummaryT = ReturnType<typeof useTranslations<"deal.dealContextSummary">>;

/** "12 000 € · décision avant le 30 oct. · Marie Dupont (DAF)", or null when nothing is filled in. Pure. */
export function dealContextSummary(
  input: {
    amountCents: number | null;
    currency: string | null;
    decisionDeadline: Date | null;
    decisionMakerName: string | null;
    decisionMakerRole: string | null;
  },
  locale: UiLocale,
  t: SummaryT,
): string | null {
  const parts: string[] = [];
  if (input.amountCents !== null) {
    parts.push(
      new Intl.NumberFormat(INTL_LOCALE[locale], {
        style: "currency",
        currency: input.currency ?? "EUR",
        maximumFractionDigits: 0,
      }).format(input.amountCents / 100),
    );
  }
  if (input.decisionDeadline) {
    parts.push(
      t("deadline", {
        date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", timeZone: "UTC" }).format(
          input.decisionDeadline,
        ),
      }),
    );
  }
  const name = input.decisionMakerName?.trim();
  const role = input.decisionMakerRole?.trim();
  if (name && role) parts.push(`${name} (${role})`);
  else if (name || role) parts.push((name || role)!);
  return parts.length > 0 ? parts.join(" · ") : null;
}
