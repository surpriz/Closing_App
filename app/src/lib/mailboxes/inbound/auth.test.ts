import { describe, expect, it } from "vitest";

import { domainOf, parseAuthenticationResults } from "./auth";

const FROM = "target.io";

describe("parseAuthenticationResults", () => {
  it("is null when the header is absent or empty", () => {
    expect(parseAuthenticationResults(undefined, FROM)).toBeNull();
    expect(parseAuthenticationResults(null, FROM)).toBeNull();
    expect(parseAuthenticationResults("  ", FROM)).toBeNull();
  });

  it("reads a Gmail header where everything passes", () => {
    const header =
      "mx.google.com; dkim=pass header.i=@target.io header.s=google header.b=AbCdEf12; " +
      "spf=pass (google.com: domain of bob@target.io designates 209.85.220.41 as permitted sender) smtp.mailfrom=bob@target.io; " +
      "dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=target.io";
    expect(parseAuthenticationResults(header, FROM)).toBe(true);
  });

  it("reads an OVH / Exim header with an aligned SPF only", () => {
    const header =
      "mx1.mail.ovh.net; spf=pass smtp.mailfrom=target.io; dkim=none (message not signed) header.d=none; dmarc=none action=none header.from=target.io";
    expect(parseAuthenticationResults(header, FROM)).toBe(true);
  });

  it("reads a Microsoft header with a spoofed sender failing DMARC", () => {
    const header =
      "spf=fail (sender IP is 203.0.113.9) smtp.mailfrom=target.io; dkim=none (message not signed) header.d=none; " +
      "dmarc=fail action=oreject header.from=target.io; compauth=fail reason=000";
    expect(parseAuthenticationResults(header, FROM)).toBe(false);
  });

  it("reads a Microsoft header that passes", () => {
    const header =
      "spf=pass (sender IP is 40.107.1.1) smtp.mailfrom=target.io; dkim=pass (signature was verified) header.d=target.io; " +
      "dmarc=pass action=none header.from=target.io; compauth=pass reason=100";
    expect(parseAuthenticationResults(header, FROM)).toBe(true);
  });

  it("accepts a DKIM pass aligned through the parent domain or header.i", () => {
    expect(parseAuthenticationResults("mx.x.net; dkim=pass header.d=target.io", "mail.target.io")).toBe(true);
    expect(parseAuthenticationResults("mx.x.net; dkim=pass header.i=bob@target.io", FROM)).toBe(true);
  });

  it("ignores a DKIM or SPF pass for another domain", () => {
    expect(parseAuthenticationResults("mx.x.net; dkim=pass header.d=evil.test; spf=pass smtp.mailfrom=bounce@evil.test", FROM)).toBeNull();
    expect(parseAuthenticationResults("mx.x.net; dkim=pass header.d=com", FROM)).toBeNull();
    expect(parseAuthenticationResults("mx.x.net; spf=pass smtp.mailfrom=sub.target.io", FROM)).toBeNull();
  });

  it("is false when the only passes are unaligned and something failed", () => {
    expect(parseAuthenticationResults("mx.x.net; dkim=pass header.d=evil.test; spf=fail smtp.mailfrom=target.io", FROM)).toBe(false);
  });

  it("does not check alignment without a From domain", () => {
    expect(parseAuthenticationResults("mx.x.net; dkim=pass header.d=evil.test")).toBe(true);
  });

  it("lets dmarc=pass stand on its own", () => {
    expect(parseAuthenticationResults("mx.x.net; spf=fail; dmarc=pass", FROM)).toBe(true);
  });

  it("treats dmarc=fail as final, even when a pass comes later", () => {
    expect(parseAuthenticationResults("mx.x.net; dmarc=fail; dkim=pass header.d=target.io; dmarc=pass", FROM)).toBe(false);
    expect(parseAuthenticationResults("mx.x.net; spf=pass smtp.mailfrom=a.io; dmarc=fail header.from=b.io", "a.io")).toBe(false);
  });

  it("refuses when DKIM and SPF both fail, or SPF fails alone", () => {
    expect(parseAuthenticationResults('mx.x.net; dkim=fail reason="bad signature"; spf=fail smtp.mailfrom=b.io', FROM)).toBe(false);
    expect(parseAuthenticationResults("mx.x.net; spf=fail smtp.mailfrom=target.io", FROM)).toBe(false);
  });

  it("lets a passing aligned signature win over a failing one", () => {
    expect(parseAuthenticationResults("mx.x.net; dkim=fail header.d=lists.io; dkim=pass header.d=target.io", FROM)).toBe(true);
  });

  it("ignores results injected in comments", () => {
    expect(parseAuthenticationResults("mx.x.net; spf=fail (dkim=pass header.d=target.io); dmarc=fail", FROM)).toBe(false);
    expect(parseAuthenticationResults("mx.x.net; spf=fail (a (nested dkim=pass header.d=target.io) spf=pass)", FROM)).toBe(false);
    expect(parseAuthenticationResults("mx.x.net; spf=fail smtp.mailfrom=b.io (; dmarc=pass)", FROM)).toBe(false);
  });

  it("ignores results injected in quoted strings", () => {
    expect(parseAuthenticationResults('mx.x.net; spf=fail smtp.mailfrom="a; dkim=pass header.d=target.io"@b.io', FROM)).toBe(false);
  });

  it("ignores a result buried in a property value", () => {
    expect(parseAuthenticationResults("mx.x.net; dkim=none header.d=spf=pass", FROM)).toBeNull();
    expect(parseAuthenticationResults("mx.x.net; spf=fail smtp.mailfrom=target.io smtp.helo=dkim=pass", FROM)).toBe(false);
  });

  it("is unknown when nothing conclusive is said", () => {
    expect(parseAuthenticationResults("mx.x.net; dkim=none; spf=neutral; dmarc=none", FROM)).toBeNull();
    expect(parseAuthenticationResults("mx.x.net; dkim=none; spf=none", FROM)).toBeNull();
    expect(parseAuthenticationResults("mx.x.net; auth=pass", FROM)).toBeNull();
  });

  it("reads a quoted local part in smtp.mailfrom", () => {
    expect(parseAuthenticationResults('mx.x.net; spf=pass smtp.mailfrom="john doe"@target.io', FROM)).toBe(true);
    expect(parseAuthenticationResults('mx.x.net; spf=pass smtp.mailfrom="x@target.io"@evil.test', FROM)).toBeNull();
  });
});

describe("domainOf", () => {
  it("takes the domain after the last @, whatever the quoted local part says", () => {
    expect(domainOf('"x@evil.test"@Target.io')).toBe("target.io");
    expect(domainOf("bob@target.io")).toBe("target.io");
    expect(domainOf("@target.io")).toBe("target.io");
    expect(domainOf("localhost")).toBeNull();
    expect(domainOf("")).toBeNull();
  });

  it("aligns a mail whose From local part imitates another domain with its real one", () => {
    const header = "mx.x.net; dkim=pass header.d=evil.test";
    expect(parseAuthenticationResults(header, domainOf('"x@evil.test"@target.io'))).toBeNull();
    expect(parseAuthenticationResults(header, domainOf("x@evil.test"))).toBe(true);
  });
});
