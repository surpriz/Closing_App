import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One field of the deal report: a heading on an ink rule, the content flush
 * below it, separated by hairlines rather than boxed.
 */
export function DealSection({
  id,
  title,
  hint,
  action,
  children,
  className,
}: {
  id?: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-titre` : undefined}
      className={cn("scroll-mt-20", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-foreground pb-2">
        <h2 id={id ? `${id}-titre` : undefined} className="text-heading">
          {title}
          {hint && (
            <span className="ml-2 text-small font-normal tracking-normal text-muted-foreground">
              {hint}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A folded field: same rule and heading, the content waits under the summary. */
export function DealFold({
  id,
  title,
  hint,
  open,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      className="group scroll-mt-20 border-b border-border"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1 py-3 outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5 text-body font-semibold">
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
          />
          {title}
        </span>
        {hint && (
          <span className="text-small text-muted-foreground">{hint}</span>
        )}
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}
