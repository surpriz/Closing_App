export type CsvParseResult = { headers: string[]; rows: string[][]; delimiter: "," | ";" | "\t" };

export const MAX_IMPORT_ROWS = 2000;
// Next caps a Server Action body at 1 MB: the pasted or uploaded CSV has to fit with some margin
export const MAX_IMPORT_BYTES = 900_000;

const DELIMITERS = [",", ";", "\t"] as const;

function detectDelimiter(text: string): CsvParseResult["delimiter"] {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  let fieldStart = true;
  for (const char of text) {
    if (quoted) {
      if (char === '"') quoted = false;
      continue;
    }
    if (char === '"' && fieldStart) {
      quoted = true;
      fieldStart = false;
      continue;
    }
    if (char === "\n" || char === "\r") break;
    fieldStart = char in counts;
    if (char in counts) counts[char]++;
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
  // a quote only opens a quoted section at the start of a field
  let fieldQuotedBefore = false;

  const endRow = () => {
    row.push(field);
    field = "";
    fieldQuotedBefore = false;
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
    } else if (char === '"' && field === "" && !fieldQuotedBefore) {
      quoted = true;
      fieldQuotedBefore = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
      fieldQuotedBefore = false;
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
  firstName: ["prenom", "firstname", "first_name"],
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

/** A first line holding an address is a prospect, not a header row: the file has no header. */
export function headerLooksLikeData(headers: string[]) {
  return headers.some((header) => EMAIL.test(header.trim()));
}

const SAMPLE_ROWS = [
  ["marie.dupont@exemple.fr", "Marie", "Dupont", "Exemple SAS", "Directrice commerciale"],
  ["paul.martin@acme.fr", "Paul", "Martin", "Acme", "Responsable achats"],
];

/** A ready-to-fill file in the seller's language: French headers and `;` open cleanly in a French Excel. */
export function sampleCsv(locale: string) {
  const fr = locale.toLowerCase().startsWith("fr");
  const headers = fr ? ["email", "prénom", "nom", "société", "poste"] : ["email", "firstName", "lastName", "company", "title"];
  const delimiter = fr ? ";" : ",";
  return "\uFEFF" + [headers, ...SAMPLE_ROWS].map((row) => row.join(delimiter)).join("\r\n") + "\r\n";
}

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
    const seen = new Set<string>();
    parsed.headers.forEach((header, index) => {
      const key = slug(header);
      if (mapped.has(index) || !key || seen.has(key)) return;
      seen.add(key); // first column wins for a given slug
      // `link` is reserved for the campaign link in templates: a column must never override it
      if (key === "link") return;
      const value = (row[index] ?? "").trim();
      if (value) vars[key] = value;
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
