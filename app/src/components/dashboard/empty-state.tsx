import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** An empty screen is an invitation to act: one sentence, one action. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-5 border-y border-foreground bg-card px-6 py-10 sm:px-10",
        className,
      )}
    >
      {Icon && (
        <span className="flex size-10 items-center justify-center border border-border text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="space-y-1.5">
        <p className="text-heading">{title}</p>
        {description && <p className="max-w-md text-body text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
