// Accented letters a French or English header or name can hold: the decoding that yields the most of them wins
const EXPECTED_LETTERS = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒÆ]/g;

/**
 * Excel's plain "CSV" export is not UTF-8: Windows-1252 on Windows, Mac Roman on a Mac. Read as UTF-8 first; when the
 * bytes refuse, decode both legacy ways and keep the one whose accents look like words.
 */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    const candidates = ["windows-1252", "macintosh"].map((label) => new TextDecoder(label).decode(bytes));
    const score = (text: string) => (text.match(EXPECTED_LETTERS) ?? []).length;
    return candidates.reduce((best, text) => (score(text) > score(best) ? text : best));
  }
}
