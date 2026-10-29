import { describe, expect, it } from "vitest";

import { suppressionsCsv } from "./suppression-csv";

const BOM = "﻿";

describe("suppressionsCsv", () => {
  it("is just the header (after the BOM) for an empty list", () => {
    expect(suppressionsCsv([])).toBe(`${BOM}email,reason,source,detail,created_at\r\n`);
  });

  it("writes one CRLF line per row with ISO dates and an empty cell for a missing detail", () => {
    const csv = suppressionsCsv([
      { email: "a@x.com", reason: "UNSUBSCRIBE", source: "link", detail: null, createdAt: new Date("2026-10-01T08:00:00Z") },
    ]);
    expect(csv).toBe(`${BOM}email,reason,source,detail,created_at\r\na@x.com,UNSUBSCRIBE,link,,2026-10-01T08:00:00.000Z\r\n`);
  });

  it("quotes fields with commas, quotes or newlines and doubles the quotes", () => {
    const csv = suppressionsCsv([
      { email: "a@x.com", reason: "BOUNCE", source: "dsn", detail: 'said "no", twice\nreally', createdAt: new Date(0) },
    ]);
    expect(csv).toContain('"said ""no"", twice\nreally"');
  });

  it("neutralises cells a spreadsheet would run as a formula", () => {
    const csv = suppressionsCsv([
      { email: '=HYPERLINK("x")@x.com', reason: "BOUNCE", source: "dsn", detail: "-1", createdAt: new Date(0) },
      { email: "+cmd|' /C calc'!A0@x.com", reason: "BOUNCE", source: "dsn", detail: null, createdAt: new Date(0) },
    ]);
    const [, first, second] = csv.split("\r\n");
    expect(first).toBe(`"'=HYPERLINK(""x"")@x.com",BOUNCE,dsn,'-1,1970-01-01T00:00:00.000Z`);
    expect(second.startsWith(`'+cmd|' /C calc'!A0@x.com,`)).toBe(true);
  });

  it("leaves a plain email untouched", () => {
    expect(suppressionsCsv([{ email: "ana@acme.com", reason: "MANUAL", source: "seller", detail: null, createdAt: new Date(0) }])).toContain(
      "\r\nana@acme.com,MANUAL",
    );
  });
});
