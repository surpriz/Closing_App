import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-title [font-stretch:92%]">{title}</h1>
        {description && <p className="max-w-2xl text-body text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** A section title without a surrounding card. */
export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-body font-semibold">
        {children}
        {hint && <span className="ml-2 font-normal text-muted-foreground">{hint}</span>}
      </h2>
      {action}
    </div>
  );
}

/** Key figures as one quiet line: "12 lectures   3 min de lecture". */
export function StatLine({
  items,
}: {
  items: { value: React.ReactNode; label: string; labelFirst?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {items.map((item) => (
        <p key={item.label} className="flex items-baseline gap-1.5">
          {item.labelFirst && <span className="text-muted-foreground">{item.label}</span>}
          <span className="font-semibold tabular-nums">{item.value}</span>
          {!item.labelFirst && <span className="text-muted-foreground">{item.label}</span>}
        </p>
      ))}
    </div>
  );
}

/** One key figure: label above, value in mono, optional hint below. */
export function Stat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "hot" | "warm" | "cold" | "success";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className="flex items-center gap-1.5 text-small text-muted-foreground">
        {tone && (
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              tone === "hot" && "bg-heat-hot",
              tone === "warm" && "bg-heat-warm",
              tone === "cold" && "bg-heat-cold",
              tone === "success" && "bg-success",
            )}
          />
        )}
        {label}
      </p>
      <p className="font-mono text-2xl font-medium tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-small text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * White surface for a list or a chart, without the card chrome. Same look as
 * `Card`; `interactive` lifts it on hover for clickable rows and tiles.
 */
export function Surface({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card shadow-xs ring-1 ring-border",
        interactive && "transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}
