import { describe, expect, it } from "vitest";

import { guessColumnMapping, MAX_IMPORT_ROWS, parseCsv, PROSPECT_COLUMNS, rowsToProspects } from "./csv";

describe("parseCsv", () => {
  it("parses commas", () => {
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual({ headers: ["a", "b"], rows: [["1", "2"], ["3", "4"]], delimiter: "," });
  });

  it("detects semicolons and tabs", () => {
    expect(parseCsv("a;b;c\n1;2;3").delimiter).toBe(";");
    expect(parseCsv("a\tb\n1\t2").delimiter).toBe("\t");
  });

  it("ignores delimiters inside quotes when detecting", () => {
    expect(parseCsv('"a,b,c";d\n1;2').delimiter).toBe(";");
  });

  it("handles doubled quotes and newlines in fields", () => {
    const out = parseCsv('a,b\n"say ""hi""","line1\nline2"\n');
    expect(out.rows).toEqual([['say "hi"', "line1\nline2"]]);
  });

  it("strips the BOM, handles CRLF and skips empty lines", () => {
    const out = parseCsv("﻿email,name\r\n\r\nx@y.z,X\r\n,\r\n");
    expect(out.headers).toEqual(["email", "name"]);
    expect(out.rows).toEqual([["x@y.z", "X"]]);
  });

  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [], delimiter: "," });
  });
});

describe("guessColumnMapping", () => {
  it("guesses FR headers with accents and case", () => {
    expect(guessColumnMapping(["E-mail", "Prénom", "Nom", "Société", "Poste", "Pays", "Fuseau", "Langue"])).toEqual({
      email: 0,
      firstName: 1,
      lastName: 2,
      company: 3,
      title: 4,
      country: 5,
      timezone: 6,
      locale: 7,
    });
  });

  it("guesses EN headers", () => {
    expect(guessColumnMapping(["Email", "first_name", "Last Name", "Company", "Job", "Country", "TZ", "Language", "Other"])).toEqual({
      email: 0,
      firstName: 1,
      lastName: 2,
      company: 3,
      title: 4,
      country: 5,
      timezone: 6,
      locale: 7,
    });
  });

  it("maps each column once", () => {
    expect(guessColumnMapping(["mail", "courriel"])).toEqual({ email: 0 });
  });

  it("lists the prospect columns", () => {
    expect(PROSPECT_COLUMNS).toContain("email");
    expect(MAX_IMPORT_ROWS).toBe(2000);
  });
});

describe("rowsToProspects", () => {
  const parsed = {
    headers: ["Email", "Prénom", "Secteur d'activité", "Taille"],
    rows: [
      ["  Ana@Acme.COM ", "Ana", "SaaS", "10"],
      ["", "Bob", "x", "y"],
      ["not-an-email", "Cy", "x", "y"],
      ["d@e.fr", "", "", "5"],
    ],
    delimiter: "," as const,
  };

  it("applies the mapping, lowercases emails, slugifies other headers", () => {
    const { prospects, rejected } = rowsToProspects(parsed, { email: 0, firstName: 1 });
    expect(prospects[0]).toEqual({
      email: "ana@acme.com",
      firstName: "Ana",
      lastName: null,
      company: null,
      title: null,
      country: null,
      timezone: null,
      locale: null,
      vars: { secteur_d_activite: "SaaS", taille: "10" },
    });
    expect(prospects[1].firstName).toBeNull();
    expect(prospects[1].vars).toEqual({ taille: "5" });
    expect(rejected).toEqual([
      { line: 3, reason: "no_email" },
      { line: 4, reason: "invalid_email" },
    ]);
  });

  it("rejects everything when no email column is mapped", () => {
    const { prospects, rejected } = rowsToProspects(parsed, {});
    expect(prospects).toEqual([]);
    expect(rejected).toHaveLength(4);
  });
});
