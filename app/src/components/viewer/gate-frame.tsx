import type { ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

/**
 * The quiet sheet every gate sits on (email, expiry, link gone, unsubscribe):
 * one narrow column on report paper, high on a phone so the keyboard leaves
 * the field in view, centred from `sm` up.
 */
export function GateFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "flex flex-1 flex-col items-center bg-background px-4 pt-[max(3.5rem,12vh)] pb-16 selection:bg-foreground/15 selection:text-foreground sm:justify-center sm:pt-16",
        className,
      )}
    >
      <div className="w-full max-w-sm animate-rise">{children}</div>
    </main>
  );
}

/** The document leads, even behind a gate: its name in the condensed report voice, then who sent it. */
export function GateTitle({
  documentName,
  senderName,
  labels,
}: {
  documentName: string;
  senderName: string | null;
  labels: ViewerLabels;
}) {
  return (
    <header>
      <h1 className="condensed line-clamp-3 text-title font-bold break-words">{documentName}</h1>
      {senderName && (
        <p className="mt-2 text-small text-muted-foreground">
          {labels.sharedBy} <span className="font-medium text-foreground">{senderName}</span>
        </p>
      )}
    </header>
  );
}

/**
 * The form block of a gate: one ink-ruled box, a micro label row, a borderless
 * field, the ink submit row attached under it. Focus rings the whole box.
 */
export const GATE_BOX =
  "overflow-hidden rounded-md border border-foreground bg-card focus-within:ring-3 focus-within:ring-ring/20 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20";

export const GATE_LABEL =
  "block border-b border-border px-3 py-2 text-micro font-medium tracking-[0.06em] text-muted-foreground uppercase";

export const GATE_FIELD =
  "block h-12 w-full bg-transparent px-3 text-base caret-foreground outline-none placeholder:text-muted-foreground sm:text-body";

/** The ink row closing a gate box: full width, attached, focus drawn inside. */
export const GATE_SUBMIT =
  "h-12 w-full justify-between rounded-none border-0 px-3 text-body focus-visible:ring-2 focus-visible:ring-primary-foreground/80 focus-visible:ring-inset";
