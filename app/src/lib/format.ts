import { INTL_LOCALE, type UiLocale } from "@/i18n/locale";

export function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const BYTE_UNITS: Record<UiLocale, [string, string, string]> = {
  en: ["B", "KB", "MB"],
  fr: ["o", "Ko", "Mo"],
};

export function formatBytes(bytes: number, locale: UiLocale) {
  const [b, kb, mb] = BYTE_UNITS[locale];
  if (bytes < 1024) return `${bytes} ${b}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ${kb}`;
  return `${(bytes / 1024 / 1024).toFixed(1)} ${mb}`;
}

const relativeFormats = new Map<UiLocale, Intl.RelativeTimeFormat>();

export function formatRelative(date: Date, locale: UiLocale, now = new Date()) {
  let relativeFormat = relativeFormats.get(locale);
  if (!relativeFormat) {
    relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeFormats.set(locale, relativeFormat);
  }
  const diffSeconds = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return relativeFormat.format(Math.round(diffSeconds), "second");
  if (abs < 3600) return relativeFormat.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return relativeFormat.format(Math.round(diffSeconds / 3600), "hour");
  return relativeFormat.format(Math.round(diffSeconds / 86400), "day");
}

export function formatDate(date: Date, locale: UiLocale) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Date as seen by someone living in `timeZone` (e.g. the prospect)
export function formatInTimeZone(date: Date, timeZone: string, locale: UiLocale) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
