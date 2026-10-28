const HEADER = ["email", "reason", "source", "detail", "created_at"];

function field(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Excel reads UTF-8 only with a BOM; lines end with CRLF as the CSV spec says. */
export function suppressionsCsv(
  rows: { email: string; reason: string; source: string; detail: string | null; createdAt: Date }[],
): string {
  const lines = [HEADER, ...rows.map((r) => [r.email, r.reason, r.source, r.detail ?? "", r.createdAt.toISOString()])];
  return `﻿${lines.map((line) => line.map(field).join(",")).join("\r\n")}\r\n`;
}
