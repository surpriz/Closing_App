import Link from "next/link";

import { PrimaryCta } from "./cta";
import { APP_URL } from "./links";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

const NAV = [
  { href: "/#comment", label: "Comment ça marche" },
  { href: "/#releves", label: "Ce que vous voyez" },
  { href: "/#pour-qui", label: "Pour qui" },
  { href: "/#faq", label: "Questions" },
];

/** The report's header strip: one hairline row, fields separated like a form. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-[90rem] items-stretch px-5 sm:px-8">
        <Link href="/" aria-label="Clozer, accueil" className="flex items-center pr-6">
          <Logo />
        </Link>
        <nav aria-label="Navigation" className="hidden items-stretch border-l border-rule md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center border-r border-rule px-4 text-small text-ink-soft transition-colors hover:bg-sheet hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <a
            href={APP_URL}
            className="hidden h-10 items-center px-3 text-small font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
          >
            Se connecter
          </a>
          <PrimaryCta>Essayer</PrimaryCta>
          <MobileMenu items={NAV} />
        </div>
      </div>
    </header>
  );
}
