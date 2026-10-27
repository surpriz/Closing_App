export type CsvParseResult = { headers: string[]; rows: string[][]; delimiter: "," | ";" | "\t" };

export const MAX_IMPORT_ROWS = 2000;

const DELIMITERS = [",", ";", "\t"] as const;

function detectDelimiter(text: string): CsvParseResult["delimiter"] {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char in counts) counts[char]++;
  }
  let best: CsvParseResult["delimiter"] = ",";
  for (const delimiter of DELIMITERS) if (counts[delimiter] > counts[best]) best = delimiter;
  return best;
}

export function parseCsv(input: string): CsvParseResult {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endRow = () => {
    row.push(field);
    field = "";
    if (row.some((cell) => cell.trim() !== "")) records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += char;
  }
  if (field !== "" || row.length > 0) endRow();

  const [headers = [], ...rows] = records;
  return { headers: headers.map((h) => h.trim()), rows, delimiter };
}

export const PROSPECT_COLUMNS = ["email", "firstName", "lastName", "company", "title", "country", "timezone", "locale"] as const;
export type ProspectColumn = (typeof PROSPECT_COLUMNS)[number];

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const HEADER_ALIASES: Record<ProspectColumn, string[]> = {
  email: ["email", "e_mail", "mail", "courriel"],
  firstName: ["prenom", "firstname", "first_name", "first_name"],
  lastName: ["nom", "lastname", "last_name", "name"],
  company: ["societe", "entreprise", "company", "organisation", "organization"],
  title: ["poste", "titre", "title", "job", "fonction"],
  country: ["pays", "country"],
  timezone: ["fuseau", "timezone", "tz"],
  locale: ["langue", "locale", "language"],
};

/** Guesses which header is which. Case- and accent-insensitive; each column is mapped at most once. */
export function guessColumnMapping(headers: string[]): Partial<Record<ProspectColumn, number>> {
  const mapping: Partial<Record<ProspectColumn, number>> = {};
  const slugs = headers.map(slug);
  for (const column of PROSPECT_COLUMNS) {
    const index = slugs.findIndex((s, i) => HEADER_ALIASES[column].includes(s) && !Object.values(mapping).includes(i));
    if (index >= 0) mapping[column] = index;
  }
  return mapping;
}

export type ProspectRow = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  country: string | null;
  timezone: string | null;
  locale: string | null;
  vars: Record<string, string>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Applies a mapping; other columns become `vars` keyed by a slug of the header. Rows without a plausible email are rejected with their line number. */
export function rowsToProspects(
  parsed: CsvParseResult,
  mapping: Partial<Record<ProspectColumn, number>>,
): { prospects: ProspectRow[]; rejected: { line: number; reason: "no_email" | "invalid_email" }[] } {
  const prospects: ProspectRow[] = [];
  const rejected: { line: number; reason: "no_email" | "invalid_email" }[] = [];
  const mapped = new Set(Object.values(mapping));
  const cell = (row: string[], column: ProspectColumn) => {
    const index = mapping[column];
    return (index === undefined ? "" : (row[index] ?? "")).trim();
  };

  parsed.rows.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const email = cell(row, "email").toLowerCase();
    if (!email) return void rejected.push({ line, reason: "no_email" });
    if (!EMAIL.test(email)) return void rejected.push({ line, reason: "invalid_email" });
    const vars: Record<string, string> = {};
    parsed.headers.forEach((header, index) => {
      const key = slug(header);
      const value = (row[index] ?? "").trim();
      if (!mapped.has(index) && key && value) vars[key] = value;
    });
    prospects.push({
      email,
      firstName: cell(row, "firstName") || null,
      lastName: cell(row, "lastName") || null,
      company: cell(row, "company") || null,
      title: cell(row, "title") || null,
      country: cell(row, "country") || null,
      timezone: cell(row, "timezone") || null,
      locale: cell(row, "locale") || null,
      vars,
    });
  });
  return { prospects, rejected };
}
