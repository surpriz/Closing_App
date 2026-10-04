/** Same mark as the app: an open ring that the hot dot closes. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
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

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">Clozer</span>
    </span>
  );
}
