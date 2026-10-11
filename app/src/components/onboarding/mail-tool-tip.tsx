"use client";

import { Paperclip, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { hideMailToolTip } from "@/app/bienvenue/actions";
import { buttonVariants } from "@/components/ui/button";
import type { MailToolTipKind } from "@/lib/onboarding";

const COPY: Record<MailToolTipKind, (mailbox: string) => string> = {
  chrome: (mailbox) =>
    `La prochaine fois, joignez simplement le PDF dans ${mailbox} : l'extension Chrome met le lien à sa place, toute seule.`,
  outlook_addin: () =>
    "La prochaine fois, joignez simplement le PDF dans Outlook : le complément Clozer met le lien à sa place, tout seul.",
  unknown: () =>
    "Vous envoyez depuis Gmail ou Outlook ? Joignez simplement le PDF : Clozer peut mettre le lien à sa place, tout seul.",
};

/**
 * Under the share screen, while the seller still copies links by hand: the
 * extension or add-in would do it for them. Hidden for good on request.
 */
export function MailToolTip({
  tool,
  mailbox,
}: {
  tool: MailToolTipKind;
  /** "Gmail" or "Outlook", for the Chrome extension. */
  mailbox: string;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <aside className="flex items-start gap-3 rounded-xl bg-muted/60 px-4 py-3 ring-1 ring-border">
      <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm">{COPY[tool](mailbox)}</p>
        <Link href="/bienvenue?etape=outil" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {tool === "unknown" ? "Voir comment" : "Installer, 2 minutes"}
        </Link>
      </div>
      <button
        type="button"
        aria-label="Ne plus afficher"
        title="Ne plus afficher"
        onClick={() => {
          setHidden(true);
          void hideMailToolTip();
        }}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </aside>
  );
}
