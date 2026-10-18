/** Free workspaces' links: a quiet "Sent with Clozer" above the decision bar, away from the chat button. */
export function PoweredBy({ label }: { label: string }) {
  return (
    <a
      href="https://www.clozer.club/?utm_source=viewer&utm_medium=badge"
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-[calc(var(--decision-bar-h,0px)+1rem)] left-4 z-10 rounded-full border border-border bg-card/90 px-3 py-1 text-small text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground max-sm:hidden"
    >
      {label}
    </a>
  );
}
