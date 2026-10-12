// INSEE headcount brackets (tranche_effectif_salarie), as returned by the company registry. Pure.

export const HEADCOUNT_BRACKETS = [
  { code: "01", min: 1, max: 2 },
  { code: "02", min: 3, max: 5 },
  { code: "03", min: 6, max: 9 },
  { code: "11", min: 10, max: 19 },
  { code: "12", min: 20, max: 49 },
  { code: "21", min: 50, max: 99 },
  { code: "22", min: 100, max: 199 },
  { code: "31", min: 200, max: 249 },
  { code: "32", min: 250, max: 499 },
  { code: "41", min: 500, max: 999 },
  { code: "42", min: 1000, max: 1999 },
  { code: "51", min: 2000, max: 4999 },
  { code: "52", min: 5000, max: 9999 },
  { code: "53", min: 10000, max: null },
] as const;

export type HeadcountBracket = (typeof HEADCOUNT_BRACKETS)[number];

const BY_CODE = new Map<string, HeadcountBracket>(HEADCOUNT_BRACKETS.map((b) => [b.code, b]));

/** "NN" and "00" say nothing usable about the size. */
export function bracketOf(code: string | null | undefined) {
  return code ? (BY_CODE.get(code) ?? null) : null;
}

export function bracketIndex(code: string) {
  return HEADCOUNT_BRACKETS.findIndex((b) => b.code === code);
}

/** Contiguous brackets merged: ["11", "12", "32"] → [{10, 49}, {250, 499}]. */
export function headcountRanges(codes: readonly string[]) {
  const sorted = [...new Set(codes)]
    .map(bracketIndex)
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  const ranges: { min: number; max: number | null }[] = [];
  let previous = -2;
  for (const index of sorted) {
    const bracket = HEADCOUNT_BRACKETS[index];
    const last = ranges.at(-1);
    if (last && index === previous + 1) last.max = bracket.max;
    else ranges.push({ min: bracket.min, max: bracket.max });
    previous = index;
  }
  return ranges;
}

export function formatHeadcountRange(range: { min: number; max: number | null }) {
  return range.max === null ? `${range.min}+ salariés` : `${range.min}-${range.max} salariés`;
}
