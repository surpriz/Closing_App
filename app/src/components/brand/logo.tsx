import { cn } from "@/lib/utils";

/** An open ring that the hot dot closes: a deal about to be signed. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
      <path
        d="M19.07 7.5A8.5 8.5 0 1 0 19.07 16.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="20.2" cy="12" r="2.2" className="fill-heat-hot" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">Clozer</span>
    </span>
  );
}
