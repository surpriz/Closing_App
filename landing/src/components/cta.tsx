import { APP_URL } from "./links";

const SIZES = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

/** The one primary action of the site: open the app. */
export function PrimaryCta({
  children = "Essayer gratuitement",
  size = "lg",
  className = "",
}: {
  children?: React.ReactNode;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <a
      href={APP_URL}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl bg-ink font-medium text-sheet shadow-sm transition-[background-color,transform] duration-150 hover:bg-ink/88 active:scale-[0.98] ${SIZES[size]} ${className}`}
    >
      {children}
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </a>
  );
}
