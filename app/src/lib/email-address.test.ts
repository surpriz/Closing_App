import { describe, expect, it } from "vitest";

import { senderAs } from "./email-address";

describe("senderAs", () => {
  it("puts the name on the configured address", () => {
    expect(senderAs("Paul via Clozer", "noreply@clozer.app")).toBe('"Paul via Clozer" <noreply@clozer.app>');
    expect(senderAs("Paul via Clozer", "Clozer <noreply@clozer.app>")).toBe('"Paul via Clozer" <noreply@clozer.app>');
  });

  it("encodes accented names", () => {
    const from = senderAs("Éloïse via Clozer", "noreply@clozer.app");
    expect(from).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <noreply@clozer.app>$/);
    expect(Buffer.from(from.split("?")[3], "base64").toString("utf8")).toBe("Éloïse via Clozer");
  });

  it("strips anything that could break the header", () => {
    expect(senderAs('Paul"\r\nBcc: x@y <z>', "noreply@clozer.app")).toBe('"PaulBcc: x@y z" <noreply@clozer.app>');
    expect(senderAs('"<>', "noreply@clozer.app")).toBe("noreply@clozer.app");
  });
});
