import { describe, expect, it } from "vitest";

import { mailboxOf, testAddress } from "./seller-address";

describe("mailboxOf", () => {
  it("drops the plus-tag and the case", () => {
    expect(mailboxOf("Jerome0laval+t7@Gmail.com")).toBe("jerome0laval@gmail.com");
    expect(mailboxOf("paul@acme.fr")).toBe("paul@acme.fr");
  });
});

describe("testAddress", () => {
  it("tags the seller's own mailbox", () => {
    expect(testAddress("Jerome0laval+old@gmail.com")).toBe("jerome0laval+test@gmail.com");
  });
});
