/** Shortening text for display without ever cutting a word in half. Pure. */

/** Clips to `max` characters, ellipsis included, ending on a whole word when one is close enough. */
export function clipAtWord(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  // A single huge word (an URL, an email) still gets cut rather than vanishing
  const end = space >= max * 0.6 ? cut.slice(0, space) : cut;
  return `${end.replace(/[\s,;:.–-]+$/, "")}…`;
}

/** Text clipped mid-word before clipAtWord existed: drop the dangling fragment. */
export function tidyEllipsis(text: string) {
  if (!text.endsWith("…")) return text;
  const body = text.slice(0, -1);
  const space = body.lastIndexOf(" ");
  if (space < 0 || /[\s.,;:!?]$/.test(body)) return text;
  return `${body.slice(0, space).replace(/[\s,;:.–-]+$/, "")}…`;
}
