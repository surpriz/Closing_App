import { cn } from "cn";

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
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        {description && <p className="text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {action}
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
      <h2 className="text-[15px] font-semibold">
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

/** White surface for a list or a chart, without the card chrome. */
export function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-card ring-1 ring-border", className)}>{children}</div>;
}
