import { describe, expect, it } from "vitest";

import { viewerSenderName } from "./sender-name";

describe("viewerSenderName", () => {
  const seller = { name: "Léa Martin", email: "lea@acme.fr" };

  it("prefers the workspace's sender name, then the seller, then the workspace", () => {
    expect(viewerSenderName({ senderName: " Acme Conseil ", createdBy: seller, organizationName: "Acme" })).toBe("Acme Conseil");
    expect(viewerSenderName({ senderName: "", createdBy: seller, organizationName: "Acme" })).toBe("Léa Martin");
    expect(viewerSenderName({ senderName: null, createdBy: { ...seller, name: null }, organizationName: "Acme" })).toBe("Acme");
  });

  it("falls back to the seller's address, then nothing", () => {
    expect(viewerSenderName({ senderName: null, createdBy: { ...seller, name: null }, organizationName: " " })).toBe("lea");
    expect(viewerSenderName({ senderName: null, createdBy: null, organizationName: null })).toBeNull();
  });
});
