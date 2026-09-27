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
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[15px] font-semibold">
        {children}
        {hint && <span className="ml-2 font-normal text-muted-foreground">{hint}</span>}
      </h2>
      {action}
    </div>
  );
}
