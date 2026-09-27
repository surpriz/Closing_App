import { cn } from "cn";

/** An empty screen is an invitation to act: one sentence, one action. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-xl border border-dashed border-input px-6 py-10 sm:px-10",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-lg font-medium tracking-[-0.01em]">{title}</p>
        {description && <p className="max-w-md text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
