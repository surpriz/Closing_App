/** A blank sheet behind the card: the document is right there, one step away. */
export function GateBackdrop() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 flex justify-center pt-10">
        <div className="aspect-[1/1.414] w-[min(42rem,92vw)] rounded-md bg-card opacity-70 shadow-lg ring-1 ring-border blur-[2px]">
          <div className="space-y-3 p-12">
            <div className="h-5 w-1/2 rounded bg-muted" />
            <div className="h-3 w-5/6 rounded bg-muted" />
            <div className="h-3 w-4/6 rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="mt-8 h-32 rounded bg-muted/70" />
          </div>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
    </>
  );
}
