import Link from "next/link";

import { CONTACT_EMAIL } from "./links";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-10 text-sm text-ink-soft sm:px-6">
        <Logo />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/confidentialite" className="transition-colors hover:text-ink">
            Confidentialité
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="transition-colors hover:text-ink">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
