import { describe, expect, it } from "vitest";

import { mailboxErrorKey, providerLabel } from "./error-copy";

describe("mailboxErrorKey", () => {
  it("tells a Google mailbox that the provider cut off access, not to type a password", () => {
    expect(mailboxErrorKey("AUTH_REVOKED", "GOOGLE")).toBe("AUTH_REVOKED_OAUTH");
  });

  it("does the same for Microsoft", () => {
    expect(mailboxErrorKey("AUTH_REVOKED", "MICROSOFT")).toBe("AUTH_REVOKED_OAUTH");
  });

  it("keeps the password wording for an IMAP mailbox", () => {
    expect(mailboxErrorKey("AUTH_REVOKED", "IMAP")).toBe("AUTH_REVOKED");
  });

  it("leaves every other code alone", () => {
    expect(mailboxErrorKey("QUOTA", "GOOGLE")).toBe("QUOTA");
    expect(mailboxErrorKey("unknown", "GOOGLE")).toBe("unknown");
  });
});

describe("providerLabel", () => {
  it("names the provider as the seller knows it", () => {
    expect(providerLabel("GOOGLE")).toBe("Google");
    expect(providerLabel("MICROSOFT")).toBe("Microsoft");
    expect(providerLabel("IMAP")).toBe("IMAP");
  });
});
