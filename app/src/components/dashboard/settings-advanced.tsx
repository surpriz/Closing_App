"use client";

import { ChevronRight } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sections that wait behind "Réglages avancés". A deep link to one of them opens the fold. */
export const ADVANCED_IDS = [
  "offre",
  "liens",
  "assistant",
  "messages",
  "extension",
  "equipe",
  "donnees",
] as const;

type Advanced = { open: boolean; setOpen: (open: boolean) => void };

const AdvancedContext = createContext<Advanced>({
  open: false,
  setOpen: () => {},
});

export function useAdvancedSettings() {
  return useContext(AdvancedContext);
}

function targetFromHash() {
  const id = window.location.hash.slice(1);
  return (ADVANCED_IDS as readonly string[]).includes(id) ? id : null;
}

/**
 * Holds whether the advanced sections are shown. Starts folded, unless the
 * address points at one of them: then it opens and scrolls there once the
 * section is rendered (the browser's own jump happened while it was hidden).
 */
export function AdvancedSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const id = targetFromHash();
      if (!id) return;
      setOpen(true);
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ block: "start" }),
      );
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <AdvancedContext.Provider value={{ open, setOpen }}>
      {children}
    </AdvancedContext.Provider>
  );
}

export function AdvancedSettingsToggle() {
  const { open, setOpen } = useAdvancedSettings();
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      aria-expanded={open}
      aria-controls="reglages-avances"
      onClick={() => setOpen(!open)}
      className="bg-card"
    >
      <ChevronRight
        className={cn("transition-transform", open && "rotate-90")}
      />
      {open ? "Masquer les réglages avancés" : "Réglages avancés"}
    </Button>
  );
}

/** Wraps sections that stay rendered (their fields keep their values) but hidden while folded. */
export function AdvancedSettingsBlock({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { open } = useAdvancedSettings();
  return (
    <div id={id} hidden={!open} className={className}>
      {children}
    </div>
  );
}

/** Anchor nav on wide screens: a link to an advanced section opens the fold first. */
export function SettingsNav({
  essential,
  advanced,
}: {
  essential: { id: string; label: string }[];
  advanced: { id: string; label: string }[];
}) {
  const { open, setOpen } = useAdvancedSettings();
  const link = useCallback(
    (section: { id: string; label: string }, isAdvanced: boolean) => (
      <li key={section.id}>
        <a
          href={`#${section.id}`}
          onClick={isAdvanced ? () => setOpen(true) : undefined}
          className="block rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors outline-none hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {section.label}
        </a>
      </li>
    ),
    [setOpen],
  );

  return (
    <nav aria-label="Sections des réglages" className="hidden lg:block">
      <ul className="sticky top-24 space-y-0.5 text-sm">
        {essential.map((section) => link(section, false))}
        <li className="pt-3 pb-1 pl-2.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="hover:text-foreground"
          >
            Avancés
          </button>
        </li>
        {advanced.map((section) => link(section, true))}
      </ul>
    </nav>
  );
}
