import { PRESETS, type PresetId } from "../presets";
import type { MailboxProvider } from "../types";

export type DkimInfo = { present: boolean; revoked: boolean };

export function parseDkim(txts: string[]): DkimInfo {
  const record = txts.map((t) => t.trim()).find((t) => /^v=DKIM1\b/i.test(t) || /(^|;)\s*p=/i.test(t));
  if (!record) return { present: false, revoked: false };
  const p = /(?:^|;)\s*p=([^;]*)/i.exec(record);
  // An empty p= is how a key is revoked.
  return { present: true, revoked: !p || p[1].trim() === "" };
}

export function dkimSelectorsFor(provider: MailboxProvider, preset: PresetId | null): string[] {
  if (provider === "GOOGLE") return ["google"];
  if (provider === "MICROSOFT") return ["selector1", "selector2"];
  return preset ? [...PRESETS[preset].dkimSelectors] : ["default", "mail", "dkim", "selector1", "k1", "s1"];
}
