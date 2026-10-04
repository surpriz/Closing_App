import Link from "next/link";

import { PrimaryCta } from "./cta";
import { APP_URL } from "./links";
import { Logo } from "./logo";

const NAV = [
  { href: "/#comment", label: "Comment ça marche" },
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#tarif", label: "Tarif" },
  { href: "/#faq", label: "Questions" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-5 sm:px-6">
        <Link href="/" aria-label="Clozer, accueil">
          <Logo />
        </Link>
        <nav aria-label="Navigation" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={APP_URL}
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            Se connecter
          </a>
          <PrimaryCta size="md">Essayer</PrimaryCta>
        </div>
      </div>
    </header>
  );
}
