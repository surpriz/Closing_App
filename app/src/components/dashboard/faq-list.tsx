"use client";

import { ArrowRight, ChevronDown, LifeBuoy, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FAQ, searchFaq } from "@/lib/closing/help/faq";

import { openHelp } from "./open-help";
import { SectionTitle, Surface } from "./page-header";

/** Opens the question a link points to (/faq#prolonger) and brings it into view. */
function useOpenFromHash() {
  useEffect(() => {
    const open = () => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        target.scrollIntoView({ block: "center" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
}

export function AskHelpButton({ variant = "outline" }: { variant?: "outline" | "default" }) {
  return (
    <Button variant={variant} onClick={openHelp}>
      <LifeBuoy />
      Poser une question
    </Button>
  );
}

export function FaqList() {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => searchFaq(query), [query]);
  const searching = query.trim().length > 1;
  useOpenFromHash();

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher : relance, Outlook, expiration…"
            aria-label="Rechercher dans les questions"
            className="h-11 pl-9"
          />
        </div>
        {!searching && (
          <nav aria-label="Thèmes" className="flex flex-wrap gap-2">
            {FAQ.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-sm border border-border bg-card px-2.5 py-1 text-small transition-colors duration-150 outline-none hover:border-foreground/40 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                {section.title}
              </a>
            ))}
          </nav>
        )}
      </div>

      {sections.length === 0 && (
        <Surface className="space-y-3 p-6 text-center">
          <p className="text-body">Aucune question ne correspond à « {query.trim()} ».</p>
          <p className="text-small text-muted-foreground">L&apos;assistant d&apos;aide vous répond tout de suite.</p>
          <AskHelpButton variant="default" />
        </Surface>
      )}

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-20">
          <SectionTitle hint={searching ? `${section.items.length}` : undefined}>{section.title}</SectionTitle>
          <Surface className="divide-y divide-border">
            {section.items.map((item) => (
              <details
                // Remounted when a search starts or ends, so matches open and the rest closes again
                key={`${item.id}-${searching}`}
                id={item.id}
                open={searching || undefined}
                className="group scroll-mt-24"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 text-body font-medium outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="space-y-3 px-5 pb-5">
                  <p className="text-body whitespace-pre-line text-muted-foreground">{item.a}</p>
                  {item.link && (
                    <Link
                      href={item.link.href}
                      className="inline-flex items-center gap-1.5 text-small font-medium underline-offset-4 hover:underline"
                    >
                      {item.link.label}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </Surface>
        </section>
      ))}

      {sections.length > 0 && (
        <Surface className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1">
            <p className="text-body font-medium">Vous n&apos;avez pas trouvé ?</p>
            <p className="text-small text-muted-foreground">
              Posez la question à l&apos;assistant, ou envoyez une idée ou un bug à l&apos;équipe.
            </p>
          </div>
          <AskHelpButton />
        </Surface>
      )}
    </div>
  );
}
