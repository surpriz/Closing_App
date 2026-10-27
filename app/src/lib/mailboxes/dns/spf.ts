export type SpfAll = "-all" | "~all" | "?all" | "+all";
export type SpfInfo = { present: boolean; record: string | null; includes: string[]; all: SpfAll | null; duplicates: boolean };
export type SpfStatus = "ok" | "missing_provider" | "missing" | "duplicate" | "unknown_provider";

export function parseSpf(txts: string[]): SpfInfo {
  const records = txts.map((t) => t.trim()).filter((t) => /^v=spf1(\s|$)/i.test(t));
  const record = records[0] ?? null;
  if (!record) return { present: false, record: null, includes: [], all: null, duplicates: false };
  const terms = record.split(/\s+/).map((t) => t.toLowerCase());
  const includes = terms.filter((t) => t.startsWith("include:")).map((t) => t.slice("include:".length));
  const all = terms.find((t) => /^[-~?+]all$/.test(t)) as SpfAll | undefined;
  return { present: true, record, includes, all: all ?? null, duplicates: records.length > 1 };
}

// Two SPF records make the whole check fail (permerror), so duplicates win over everything else.
export function spfStatus(spf: SpfInfo, expectedInclude: string | null): SpfStatus {
  if (!spf.present) return "missing";
  if (spf.duplicates) return "duplicate";
  if (!expectedInclude) return "unknown_provider";
  return spf.includes.includes(expectedInclude.toLowerCase()) ? "ok" : "missing_provider";
}
