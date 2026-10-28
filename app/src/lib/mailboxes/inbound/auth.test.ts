import { describe, expect, it } from "vitest";

import { parseAuthenticationResults } from "./auth";

describe("parseAuthenticationResults", () => {
  it("is null when the header is absent or empty", () => {
    expect(parseAuthenticationResults(undefined)).toBeNull();
    expect(parseAuthenticationResults(null)).toBeNull();
    expect(parseAuthenticationResults("  ")).toBeNull();
  });

  it("reads a Gmail header where everything passes", () => {
    const header =
      "mx.google.com; dkim=pass header.i=@target.io header.s=google header.b=AbCdEf12; " +
      "spf=pass (google.com: domain of bob@target.io designates 209.85.220.41 as permitted sender) smtp.mailfrom=bob@target.io; " +
      "dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=target.io";
    expect(parseAuthenticationResults(header)).toBe(true);
  });

  it("reads an OVH / Exim header with SPF only", () => {
    const header =
      "mx1.mail.ovh.net; spf=pass smtp.mailfrom=target.io; dkim=none (message not signed) header.d=none; dmarc=none action=none header.from=target.io";
    expect(parseAuthenticationResults(header)).toBe(true);
  });

  it("reads a Microsoft header with a spoofed sender failing DMARC", () => {
    const header =
      "spf=fail (sender IP is 203.0.113.9) smtp.mailfrom=target.io; dkim=none (message not signed) header.d=none; " +
      "dmarc=fail action=oreject header.from=target.io; compauth=fail reason=000";
    expect(parseAuthenticationResults(header)).toBe(false);
  });

  it("reads a Microsoft header that passes", () => {
    const header =
      "spf=pass (sender IP is 40.107.1.1) smtp.mailfrom=target.io; dkim=pass (signature was verified) header.d=target.io; " +
      "dmarc=pass action=none header.from=target.io; compauth=pass reason=100";
    expect(parseAuthenticationResults(header)).toBe(true);
  });

  it("refuses a DMARC failure even when SPF passes", () => {
    expect(parseAuthenticationResults("mx.example.net; spf=pass smtp.mailfrom=a.io; dmarc=fail header.from=b.io")).toBe(false);
  });

  it("refuses when DKIM and SPF both fail", () => {
    expect(parseAuthenticationResults("mx.example.net; dkim=fail reason=\"bad signature\"; spf=fail smtp.mailfrom=b.io")).toBe(false);
  });

  it("lets a passing signature win over a failing one", () => {
    expect(parseAuthenticationResults("mx.example.net; dkim=fail header.d=lists.io; dkim=pass header.d=target.io")).toBe(true);
  });

  it("is unknown when nothing conclusive is said", () => {
    expect(parseAuthenticationResults("mx.example.net; dkim=none; spf=neutral; dmarc=none")).toBeNull();
    expect(parseAuthenticationResults("mx.example.net; dkim=fail; spf=none")).toBeNull();
    expect(parseAuthenticationResults("mx.example.net; auth=pass")).toBeNull();
  });

  it("does not take header.d=... or free text for a verdict", () => {
    expect(parseAuthenticationResults("mx.example.net; dkim=none header.d=spf=pass")).toBeNull();
  });
});
