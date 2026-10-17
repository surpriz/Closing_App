import { pickLocale, setLocale } from "@ext/copy";

// Outlook's UI language, not the browser's: the pane, the notices and the
// Accept-Language sent to the app follow it. Call once Office is ready (taskpane)
// or when an event fires (commands runtime), when Office.context is filled in.
export function syncLocale() {
  const office = typeof Office !== "undefined" ? Office.context?.displayLanguage : undefined;
  const locale = pickLocale(office || (typeof navigator !== "undefined" ? navigator.language : undefined));
  setLocale(locale);
  if (typeof document !== "undefined" && document.documentElement) document.documentElement.lang = locale;
  return locale;
}
