import { FileText } from "lucide-react";

import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

type Props = {
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
  /** Right side: page counter, external link… */
  aside?: React.ReactNode;
  /** 0–1, drawn as a hairline under the header. */
  progress?: number;
  className?: string;
};

export function ViewerHeader({ documentName, senderName, labels, aside, progress, className }: Props) {
  return (
    <header className={`sticky top-0 z-10 border-b bg-background/85 backdrop-blur-md ${className ?? ""}`}>
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-xs ring-1 ring-border">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-sm font-semibold">{documentName}</h1>
          {senderName && (
            <p className="truncate text-xs text-muted-foreground">
              {labels.sharedBy} {senderName}
            </p>
          )}
        </div>
        {aside}
      </div>
      {progress !== undefined && (
        <div className="absolute inset-x-0 -bottom-px h-0.5 bg-transparent" aria-hidden>
          <div
            className="h-full origin-left bg-brand transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
          />
        </div>
      )}
    </header>
  );
}
