"use client";

import { Brain, CornerDownLeft, FileText, Search, Settings2, Sun, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export type CommandEntry = {
  kind: "deal" | "document";
  href: string;
  label: string;
  hint?: string;
};

type Item = CommandEntry | { kind: "page"; href: string; label: string; hint?: string };

const PAGES: Item[] = [
  { kind: "page", href: "/dashboard", label: "Aujourd'hui" },
  { kind: "page", href: "/documents", label: "Documents" },
  { kind: "page", href: "/comment-ca-marche", label: "Comment ça marche" },
  { kind: "page", href: "/settings", label: "Réglages" },
];

const PAGE_ICONS: Record<string, typeof Sun> = {
  "/dashboard": Sun,
  "/documents": FileText,
  "/comment-ca-marche": Brain,
  "/settings": Settings2,
};

const GROUPS = [
  { kind: "deal", title: "Prospects" },
  { kind: "document", title: "Documents" },
  { kind: "page", title: "Aller à" },
] as const;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** ⌘K: jump to any prospect, document or page. Everything is filtered client side. */
export function CommandMenu({ entries }: { entries: CommandEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const all: Item[] = [...entries, ...PAGES];
    const matched = q
      ? all.filter((item) => fold(`${item.label} ${item.hint ?? ""}`).includes(q))
      : [...entries.slice(0, 6), ...PAGES];
    // Group order, so arrow keys follow what is on screen
    return GROUPS.flatMap((group) => matched.filter((item) => item.kind === group.kind).slice(0, 8));
  }, [entries, query]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-56 items-center gap-2 rounded-lg bg-muted/70 px-2.5 text-sm text-muted-foreground ring-1 ring-border transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 md:flex"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">Rechercher…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <button
        type="button"
        aria-label="Rechercher"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 md:hidden"
      >
        <Search className="size-4.5" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-[15vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Rechercher</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(results[active]);
                }
              }}
              placeholder="Un prospect, une société, un document…"
              aria-label="Rechercher"
              aria-controls="command-results"
              aria-activedescendant={results[active] ? `command-${active}` : undefined}
              role="combobox"
              aria-expanded
              className="h-12 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div id="command-results" role="listbox" className="max-h-[min(60vh,24rem)] overflow-y-auto p-2">
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">Rien ne correspond.</p>
            )}
            {GROUPS.map((group) => {
              const items = results
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.kind === group.kind);
              if (items.length === 0) return null;
              return (
                <div key={group.kind} className="pb-1">
                  <p className="px-3 pt-2 pb-1 text-micro font-medium tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </p>
                  {items.map(({ item, index }) => {
                    const Icon =
                      item.kind === "deal" ? User : item.kind === "document" ? FileText : PAGE_ICONS[item.href];
                    return (
                      <div
                        key={`${item.kind}-${item.href}`}
                        id={`command-${index}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseMove={() => setActive(index)}
                        onClick={() => go(item)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                          index === active && "bg-muted",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate font-medium">{item.label}</span>
                        {item.hint && <span className="truncate text-muted-foreground">{item.hint}</span>}
                        {index === active && (
                          <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
