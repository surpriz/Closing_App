import type { PresetId } from "../presets";
import { PRESETS } from "../presets";
import type { MailboxProvider } from "../types";
import { parseDkim, dkimSelectorsFor } from "./dkim";
import { parseDmarc, type DmarcPolicy } from "./dmarc";
import { classifyDomain, type MxClassification } from "./mx";
import type { DnsResolver } from "./resolver";
import { parseSpf, spfStatus, type SpfStatus } from "./spf";

export type DnsReport = {
  spf: { status: SpfStatus; record: string | null };
  dmarc: { status: "ok" | "none_policy" | "missing"; policy: DmarcPolicy | null };
  dkim: { status: "verified" | "revoked" | "unknown"; selector: string | null };
  checkedAt: string;
};

type Input = {
  domain: string;
  provider: MailboxProvider;
  preset: PresetId | null;
  knownSelector?: string | null;
  resolver: DnsResolver;
  now: Date;
};

// Microsoft 365 publishes DKIM as a CNAME to *.onmicrosoft.com, so a TXT miss falls back to CNAME.
async function lookupDkim(resolver: DnsResolver, host: string) {
  const txt = parseDkim(await resolver.txt(host));
  if (txt.present) return txt;
  const cnames = await resolver.cname(host);
  return cnames.length ? { present: true, revoked: false } : txt;
}

export async function runDnsChecks(input: Input): Promise<DnsReport> {
  const { domain, provider, preset, resolver } = input;
  const expectedInclude =
    provider === "GOOGLE" ? "_spf.google.com" : provider === "MICROSOFT" ? "spf.protection.outlook.com" : (preset ? PRESETS[preset].spfInclude : null);

  const spf = parseSpf(await resolver.txt(domain));
  const dmarc = parseDmarc(await resolver.txt(`_dmarc.${domain}`));

  const selectors = [...new Set([...(input.knownSelector ? [input.knownSelector] : []), ...dkimSelectorsFor(provider, preset)])];
  let dkim: DnsReport["dkim"] = { status: "unknown", selector: null };
  for (const selector of selectors) {
    const found = await lookupDkim(resolver, `${selector}._domainkey.${domain}`);
    if (found.present) {
      dkim = { status: found.revoked ? "revoked" : "verified", selector };
      break;
    }
  }

  return {
    spf: { status: spfStatus(spf, expectedInclude), record: spf.record },
    dmarc: {
      status: !dmarc.present ? "missing" : dmarc.policy === "none" || dmarc.policy === null ? "none_policy" : "ok",
      policy: dmarc.policy,
    },
    dkim,
    checkedAt: input.now.toISOString(),
  };
}

export async function detectMailbox(domain: string, resolver: DnsResolver): Promise<MxClassification> {
  const mx = await resolver.mx(domain);
  const hosts = [...mx].sort((a, b) => a.priority - b.priority).map((m) => m.exchange);
  return classifyDomain(domain, hosts);
}
