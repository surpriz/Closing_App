"use client";

import { useEffect, useState } from "react";

import { PrimaryCta } from "./cta";
import { APP_URL } from "./links";

/**
 * The only client component of the site: a 44px button that drops the nav under the header on small screens.
 * Not a <details>: the /#section anchors must keep working without reloading the page, so we close on hashchange.
 */
export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("hashchange", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((value) => !value)}
        className="-mr-2 ml-1 flex size-11 items-center justify-center text-ink transition-colors hover:bg-sheet"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div
          id="mobile-menu"
          onClick={() => setOpen(false)}
          className="absolute inset-x-0 top-full border-b border-ink bg-paper px-5 py-2"
        >
          <nav aria-label="Navigation" className="grid divide-y divide-rule">
            {items.map((item) => (
              <a key={item.href} href={item.href} className="py-3.5 text-lead font-medium text-ink">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-between gap-3 border-t border-ink py-3">
            <a href={APP_URL} className="py-2 text-body font-medium text-ink-soft hover:text-ink">
              Se connecter
            </a>
            <PrimaryCta>Essayer</PrimaryCta>
          </div>
        </div>
      )}
    </div>
  );
}
