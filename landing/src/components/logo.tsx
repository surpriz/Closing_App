/** Same mark as the app: a measuring reticle closing on one hot spot. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M3 8.5V3h5.5M15.5 3H21v5.5M21 15.5V21h-5.5M8.5 21H3v-5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <circle cx="12" cy="12" r="3.4" className="fill-iron-2" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <LogoMark />
      <span className="condensed text-[1.5rem] leading-none font-bold tracking-[-0.03em]">clozer</span>
    </span>
  );
}
