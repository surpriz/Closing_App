export type DmarcPolicy = "none" | "quarantine" | "reject";
export type DmarcInfo = { present: boolean; policy: DmarcPolicy | null; rua: string | null };

export function parseDmarc(txts: string[]): DmarcInfo {
  const record = txts.map((t) => t.trim()).find((t) => /^v=DMARC1\s*;?/i.test(t));
  if (!record) return { present: false, policy: null, rua: null };
  const tags = new Map<string, string>();
  for (const part of record.split(";")) {
    const [key, ...rest] = part.split("=");
    if (key && rest.length) tags.set(key.trim().toLowerCase(), rest.join("=").trim());
  }
  const p = tags.get("p")?.toLowerCase();
  const policy = p === "none" || p === "quarantine" || p === "reject" ? p : null;
  return { present: true, policy, rua: tags.get("rua") || null };
}
