import type { ReactNode } from "react";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// Shared frame for the legal pages: same typography as the privacy policy
export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 text-body text-ink-soft sm:px-6 md:py-20 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-title font-medium text-ink [font-stretch:92%]">{title}</h1>
        <p>Mise à jour le {updatedAt}.</p>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
