import Link from "next/link";

import { CONTACT_EMAIL } from "./links";
import { Logo } from "./logo";

const LEGAL_LINKS = [
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cgu", label: "CGU" },
  { href: "/sous-traitants", label: "Sous-traitants" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/support", label: "Support" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink">
      <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-6 px-5 py-8 text-small text-ink-soft sm:px-8">
        <Logo />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="underline-offset-4 transition-colors hover:text-ink hover:underline">
              {link.label}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline-offset-4 transition-colors hover:text-ink hover:underline">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}
