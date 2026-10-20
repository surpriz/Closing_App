import type { Locale } from "@/i18n/routing";

import { appUrl } from "./links";

/** Compact entry to the app, for the header and the mobile menu. */
export function PrimaryCta({ locale, children, className = "" }: { locale: Locale; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={appUrl(locale)}
      className={`inline-flex h-10 items-center justify-center bg-ink px-4 text-small font-semibold whitespace-nowrap text-sheet transition-colors hover:bg-ink/88 ${className}`}
    >
      {children}
    </a>
  );
}
