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
});
