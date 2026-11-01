"use client";

import { Paperclip, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { hideMailToolTip } from "@/app/welcome/actions";
import { buttonVariants } from "@/components/ui/button";
import type { MailToolTipKind } from "@/lib/onboarding";

const COPY_KEY = { chrome: "chrome", outlook_addin: "outlookAddin", unknown: "unknown" } as const satisfies Record<
  MailToolTipKind,
  string
>;

/**
 * Under the share screen, while the seller still copies links by hand: the
 * extension or add-in would do it for them. Hidden for good on request.
 */
export function MailToolTip({
  tool,
  mailbox,
  action,
  returnTo,
  inline = false,
}: {
  tool: MailToolTipKind;
  /** "Gmail" or "Outlook", for the Chrome extension. */
  mailbox: string;
  /** Replaces the link to the setup step, e.g. when the extension only needs connecting. */
  action?: React.ReactNode;
  /** Where the setup step's "Terminé" leads back to: the page the tip sits on. */
  returnTo?: string;
  /** Inside another frame (the share screen): no border or background of its own. */
  inline?: boolean;
}) {
  const t = useTranslations("onboarding.mailToolTip");
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <aside
      className={
        inline
          ? "flex items-start gap-3 border-t border-border pt-3"
          : "flex items-start gap-3 border-y border-border bg-card px-4 py-3"
      }
    >
      <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-body">{t(COPY_KEY[tool], { mailbox })}</p>
        {action ?? (
          <Link
            href={`/welcome?step=tool${returnTo ? `&from=${encodeURIComponent(returnTo)}` : ""}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}>
            {tool === "unknown" ? t("seeHow") : t("install")}
          </Link>
        )}
      </div>
      <button
        type="button"
        aria-label={t("hide")}
        title={t("hide")}
        onClick={() => {
          setHidden(true);
          void hideMailToolTip();
        }}
        className="rounded-sm p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  );
}
