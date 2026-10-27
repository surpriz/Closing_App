import { describe, expect, it } from "vitest";

import { classifyDomain, classifyMx } from "./mx";

describe("classifyMx", () => {
  it.each([
    ["smtp.google.com", "GOOGLE", "gmail-app-password"],
    ["alt1.aspmx.l.google.com", "GOOGLE", "gmail-app-password"],
    ["aspmx.l.google.com", "GOOGLE", "gmail-app-password"],
    ["acme-fr.mail.protection.outlook.com", "MICROSOFT", null],
    ["acme.mail.eo.outlook.com", "MICROSOFT", null],
    ["mx3.mail.ovh.net", "IMAP", "ovh"],
    ["spool.mail.gandi.net", "IMAP", "gandi"],
    ["mx00.ionos.fr", "IMAP", "ionos"],
    ["mx.kundenserver.de", "IMAP", "ionos"],
    ["mx00.1and1.fr", "IMAP", "ionos"],
    ["mta-1.mail.infomaniak.ch", "IMAP", "infomaniak"],
    ["mx1.o2switch.net", "IMAP", "o2switch"],
    ["mail.example.org", "IMAP", null],
  ])("%s", (host, provider, preset) => {
    expect(classifyMx([host.toUpperCase() + "."])).toEqual({ provider, preset, mxHost: host });
  });

  it("uses the first host and handles an empty list", () => {
    expect(classifyMx(["mx1.o2switch.net", "aspmx.l.google.com"]).preset).toBe("o2switch");
    expect(classifyMx([])).toEqual({ provider: "IMAP", preset: null, mxHost: null });
  });
});

describe("classifyDomain", () => {
  it("decides consumer domains before the MX", () => {
    expect(classifyDomain("gmail.com", ["whatever.example"])).toMatchObject({ provider: "GOOGLE", preset: "gmail-app-password" });
    expect(classifyDomain("hotmail.fr", [])).toMatchObject({ provider: "MICROSOFT" });
    expect(classifyDomain("live.com", [])).toMatchObject({ provider: "MICROSOFT" });
    expect(classifyDomain("outlook.com", [])).toMatchObject({ provider: "MICROSOFT" });
  });
  it("falls back to the MX, and to IMAP without MX", () => {
    expect(classifyDomain("acme.fr", ["mx0.mail.ovh.net"]).preset).toBe("ovh");
    expect(classifyDomain("acme.fr", [])).toEqual({ provider: "IMAP", preset: null, mxHost: null });
  });
});
