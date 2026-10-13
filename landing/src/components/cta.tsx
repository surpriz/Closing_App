import { APP_URL } from "./links";

/** Compact entry to the app, for the header and the mobile menu. */
export function PrimaryCta({ children = "Essayer", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <a
      href={APP_URL}
      className={`inline-flex h-10 items-center justify-center bg-ink px-4 text-small font-semibold text-sheet transition-colors hover:bg-ink/88 ${className}`}
    >
      {children}
    </a>
  );
}
