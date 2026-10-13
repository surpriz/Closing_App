/**
 * The decision strip is a report form footer: cells laid 1px apart on a
 * hairline ground (`gap-px bg-border`), square, the same height in a row.
 * Shared with the voice note trigger, which the viewer drops into the strip.
 */
export const STRIP_CELL =
  "relative h-auto min-h-12 rounded-none border-0 bg-card px-0 text-small font-medium hover:bg-muted focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:not-aria-[haspopup]:scale-100";

/** A secondary action: icon alone on phones (44px+ target), its label from `sm`. */
export const STRIP_ICON_CELL = "w-12 shrink-0";

/** The bar's height, published on <html> so floating pieces (capsule, nudge, chat) sit above it. */
export const BAR_HEIGHT_VAR = "--decision-bar-h";
