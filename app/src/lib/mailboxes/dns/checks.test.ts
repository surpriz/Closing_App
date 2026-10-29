import { describe, expect, it } from "vitest";

import { detectMailbox, runDnsChecks } from "./checks";
import type { DnsResolver } from "./resolver";

function fake(records: { mx?: Record<string, { exchange: string; priority: number }[]>; txt?: Record<string, string[]>; cname?: Record<string, string[]> }): DnsResolver {
  return {
    mx: async (d) => records.mx?.[d] ?? [],
    txt: async (n) => records.txt?.[n] ?? [],
    cname: async (n) => records.cname?.[n] ?? [],
  };
}
const now = new Date("2026-10-27T10:00:00Z");

describe("runDnsChecks", () => {
  it("builds a full report", async () => {
    const resolver = fake({
      txt: {
        "acme.fr": ["v=spf1 include:mx.ovh.com ~all"],
        "_dmarc.acme.fr": ["v=DMARC1; p=quarantine"],
        "k1._domainkey.acme.fr": ["v=DKIM1; p=ABC"],
      },
    });
    expect(await runDnsChecks({ domain: "acme.fr", provider: "IMAP", preset: "ovh", resolver, now })).toEqual({
      spf: { status: "ok", record: "v=spf1 include:mx.ovh.com ~all" },
      dmarc: { status: "ok", policy: "quarantine" },
      dkim: { status: "verified", selector: "k1" },
      checkedAt: "2026-10-27T10:00:00.000Z",
    });
  });

  it("marks a consumer domain as the provider's business, records still checked", async () => {
    const resolver = fake({ txt: { "gmail.com": ["v=spf1 redirect=_spf.google.com"], "_dmarc.gmail.com": ["v=DMARC1; p=none"] } });
    const r = await runDnsChecks({ domain: "gmail.com", provider: "GOOGLE", preset: "gmail-app-password", resolver, now });
    expect(r).toMatchObject({ managedBy: "google", spf: { status: "ok" }, dmarc: { status: "none_policy" } });
    const own = await runDnsChecks({ domain: "acme.fr", provider: "GOOGLE", preset: null, resolver: fake({}), now });
    expect(own.managedBy).toBeUndefined();
  });

  it("tries the known selector first", async () => {
    const resolver = fake({ txt: { "x.fr": [], "foo._domainkey.x.fr": ["v=DKIM1; p=A"], "default._domainkey.x.fr": ["v=DKIM1; p="] } });
    const r = await runDnsChecks({ domain: "x.fr", provider: "IMAP", preset: "ovh", knownSelector: "foo", resolver, now });
    expect(r.dkim).toEqual({ status: "verified", selector: "foo" });
  });

  it("falls back to CNAME for Microsoft", async () => {
    const resolver = fake({ cname: { "selector1._domainkey.acme.fr": ["selector1-acme-fr._domainkey.acme.onmicrosoft.com"] } });
    const r = await runDnsChecks({ domain: "acme.fr", provider: "MICROSOFT", preset: null, resolver, now });
    expect(r.dkim).toEqual({ status: "verified", selector: "selector1" });
  });

  it("flags a revoked key", async () => {
    const resolver = fake({ txt: { "google._domainkey.acme.fr": ["v=DKIM1; p="] } });
    expect((await runDnsChecks({ domain: "acme.fr", provider: "GOOGLE", preset: null, resolver, now })).dkim.status).toBe("revoked");
  });

  it("stays honestly unknown and reports missing records", async () => {
    const r = await runDnsChecks({ domain: "acme.fr", provider: "IMAP", preset: null, resolver: fake({}), now });
    expect(r.dkim).toEqual({ status: "unknown", selector: null });
    expect(r.spf).toEqual({ status: "missing", record: null });
    expect(r.dmarc).toEqual({ status: "missing", policy: null });
  });

  it("reports a none policy", async () => {
    const resolver = fake({ txt: { "_dmarc.acme.fr": ["v=DMARC1; p=none"] } });
    expect((await runDnsChecks({ domain: "acme.fr", provider: "IMAP", preset: null, resolver, now })).dmarc.status).toBe("none_policy");
  });
});

describe("detectMailbox", () => {
  it("sorts MX by priority", async () => {
    const resolver = fake({
      mx: { "acme.fr": [{ exchange: "aspmx.l.google.com", priority: 20 }, { exchange: "mx1.o2switch.net", priority: 5 }] },
    });
    expect(await detectMailbox("acme.fr", resolver)).toEqual({ provider: "IMAP", preset: "o2switch", mxHost: "mx1.o2switch.net" });
  });
});
