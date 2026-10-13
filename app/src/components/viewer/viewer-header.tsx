"use client";

import { Lock, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

import { PrivacyNotice } from "./privacy-notice";

type Props = {
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
  /** Which privacy notice the lock opens: pages, opening time, or parts of a video. */
  kind?: "pdf" | "web" | "video";
  /** Right side: page counter, external link… */
  aside?: React.ReactNode;
  /** 0–1, drawn as an ink rule under the header: the reader's own place, nothing more. */
  progress?: number;
  className?: string;
};

/**
 * The thin strip the document is bound under: its title in the condensed
 * report voice, who sent it, and a lock that always opens the privacy notice
 * (what the sender sees), wherever the reader is in the document.
 */
export function ViewerHeader({ documentName, senderName, labels, kind = "pdf", aside, progress, className }: Props) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const noticeId = useId();

  return (
    <header
      className={cn(
        "sticky top-0 z-10 border-b border-border bg-background pt-[env(safe-area-inset-top)] supports-backdrop-filter:bg-background/90 supports-backdrop-filter:backdrop-blur-sm",
        className,
      )}
    >
      <div className="mx-auto flex h-12 max-w-4xl items-center gap-2 pr-2 pl-4 sm:h-14 sm:gap-3 sm:pr-3">
        <div className="min-w-0 flex-1">
          <h1 className="condensed truncate text-heading leading-tight font-bold tracking-[-0.015em]">{documentName}</h1>
          {senderName && (
            <p className="truncate text-micro text-muted-foreground sm:text-small sm:leading-tight">
              {labels.sharedBy} {senderName}
            </p>
          )}
        </div>
        {aside}
        <Button
          variant="ghost"
          size="sm"
          className="h-11 min-w-11 px-2 text-muted-foreground sm:h-8 sm:min-w-0"
          aria-expanded={privacyOpen}
          aria-controls={noticeId}
          onClick={() => setPrivacyOpen((open) => !open)}
        >
          <Lock data-icon="inline-start" aria-hidden />
          <span className="max-sm:sr-only">{labels.privacyLink}</span>
        </Button>
      </div>

      {privacyOpen && (
        <div id={noticeId} className="animate-rise border-t border-border bg-card">
          <div className="mx-auto flex max-w-4xl items-start gap-3 py-3 pr-2 pl-4 sm:pr-3">
            <PrivacyNotice labels={labels} web={kind === "web"} video={kind === "video"} className="flex-1 pt-1.5" />
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 sm:size-9"
              aria-label={labels.chatClose}
              onClick={() => setPrivacyOpen(false)}
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      {progress !== undefined && (
        <div className="absolute inset-x-0 -bottom-px h-0.5" aria-hidden>
          <div
            className="h-full origin-left bg-foreground transition-transform duration-300 ease-out-soft"
            style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
          />
        </div>
      )}
    </header>
  );
}
