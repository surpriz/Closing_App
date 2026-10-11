/**
 * Reads a single `Range: bytes=…` header against a file size. Pure.
 * Null means "send the whole file" (no header, or several ranges).
 */
/** Caps a range to `maxBytes` from its start: browsers ask for the rest of the file and accept less. Pure. */
export function capRange(range: { start: number; end: number }, maxBytes: number) {
  return { start: range.start, end: Math.min(range.end, range.start + maxBytes - 1) };
}

export function parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    // bytes=-500: the last 500 bytes
    const suffix = Number(rawEnd);
    if (suffix === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
