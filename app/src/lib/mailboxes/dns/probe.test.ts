import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { mailbox: { findUnique: (a: unknown) => findUnique(a), updateMany: (a: unknown) => updateMany(a) } } }));

import { dkimSignatureInfo, parseProbeAddress, probeAddress, recordDkimProbe, verdictToBoolean } from "./probe";

const secret = "a-test-secret-that-is-long-enough-123";
const domain = "reply.clozer.club";
const now = new Date("2026-10-27T10:00:00Z");

describe("probe addresses", () => {
  it("round-trips the mailbox id, whatever the case", () => {
    const address = probeAddress("cmbox123def456ghi789", domain, secret);
    expect(address).toMatch(/^dkim-cmbox123def456ghi789\.[0-9a-f]{12}@reply\.clozer\.club$/);
    expect(parseProbeAddress(address, domain, secret)).toBe("cmbox123def456ghi789");
    expect(parseProbeAddress(address.toUpperCase(), domain, secret)).toBe("cmbox123def456ghi789");
  });

  it("rejects forged, foreign and relay addresses", () => {
    const address = probeAddress("cmbox123def456ghi789", domain, secret);
    expect(parseProbeAddress(address.replace("cmbox", "cmxyz"), domain, secret)).toBeNull();
    expect(parseProbeAddress(address, "other.club", secret)).toBeNull();
    expect(parseProbeAddress(address, domain, "another-secret-that-is-long-enough-12")).toBeNull();
    expect(parseProbeAddress(`r-cmbox123def456ghi789.abcdef123456@${domain}`, domain, secret)).toBeNull();
  });
});

describe("dkimSignatureInfo", () => {
  it("reads selector and domain from a folded header", () => {
    const header = "v=1; a=rsa-sha256; c=relaxed/relaxed;\r\n d=Acme.fr; s=Google;\r\n h=from:to; bh=abc=; b=xyz";
    expect(dkimSignatureInfo({ "dkim-signature": header })).toEqual({ selector: "google", domain: "acme.fr" });
  });

  it("is null without a usable signature", () => {
    expect(dkimSignatureInfo({})).toBeNull();
    expect(dkimSignatureInfo({ "dkim-signature": "v=1; bh=abc" })).toBeNull();
  });
});

describe("verdictToBoolean", () => {
  it("maps PASS and FAIL only", () => {
    expect(verdictToBoolean("PASS")).toBe(true);
    expect(verdictToBoolean("FAIL")).toBe(false);
    expect(verdictToBoolean("GRAY")).toBeNull();
    expect(verdictToBoolean(undefined)).toBeNull();
  });
});

describe("recordDkimProbe", () => {
  beforeEach(() => {
    findUnique.mockReset();
    updateMany.mockReset();
    findUnique.mockResolvedValue({ id: "m1", email: "paul@acme.fr", domain: "acme.fr", dnsDetail: { dkim: { status: "unknown", selector: null } } });
  });
  const headers = { "dkim-signature": "v=1; d=acme.fr; s=sel1; b=x" };

  it("writes nothing for an unknown mailbox or another sender", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await recordDkimProbe({ mailboxId: "m1", fromEmail: "paul@acme.fr", verdicts: {}, headers, now })).toBe("unknown_mailbox");
    expect(await recordDkimProbe({ mailboxId: "m1", fromEmail: "eve@evil.com", verdicts: { dkim: "PASS" }, headers, now })).toBe("wrong_sender");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("records PASS and keeps the selector", async () => {
    const outcome = await recordDkimProbe({
      mailboxId: "m1", fromEmail: "Paul@Acme.fr", verdicts: { spf: "PASS", dkim: "PASS", dmarc: "PASS" }, headers, now,
    });
    expect(outcome).toBe("recorded");
    const { where, data } = updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: "m1" });
    expect(data).toMatchObject({ spfOk: true, dkimOk: true, dmarcOk: true, dkimSelector: "sel1", dnsCheckedAt: now });
    expect(data.dnsDetail.dkim).toEqual({ status: "verified", selector: "sel1" });
    expect(data.dnsDetail.probe).toMatchObject({ selector: "sel1", dkim: "PASS", spf: "PASS", dmarc: "PASS" });
  });

  it("records FAIL as false and leaves other verdicts untouched", async () => {
    await recordDkimProbe({ mailboxId: "m1", fromEmail: "paul@acme.fr", verdicts: { dkim: "FAIL", spf: "GRAY" }, headers: {}, now });
    const { data } = updateMany.mock.calls[0][0];
    expect(data.dkimOk).toBe(false);
    expect(data).not.toHaveProperty("spfOk");
    expect(data).not.toHaveProperty("dmarcOk");
    expect(data).not.toHaveProperty("dkimSelector");
    expect(data.dnsDetail.dkim.status).toBe("unknown");
  });

  it("does not credit a PASS signed for another domain", async () => {
    await recordDkimProbe({
      mailboxId: "m1", fromEmail: "paul@acme.fr", verdicts: { dkim: "PASS" }, headers: { "dkim-signature": "d=relay.example; s=x" }, now,
    });
    const { data } = updateMany.mock.calls[0][0];
    expect(data).not.toHaveProperty("dkimOk");
    expect(data.dnsDetail.dkim.status).toBe("unknown");
  });
});
