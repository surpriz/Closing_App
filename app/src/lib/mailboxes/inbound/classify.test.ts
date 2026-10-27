import { describe, expect, it } from "vitest";

import { classifyDsn } from "./classify";
import type { DsnDetails } from "../types";

const dsn = (over: Partial<DsnDetails>): DsnDetails => ({
  action: "failed",
  status: null,
  diagnostic: null,
  failedRecipient: null,
  originalMessageId: null,
  ...over,
});

describe("classifyDsn", () => {
  it.each([
    [{ status: "5.1.0" }, "permanent"],
    [{ status: "5.1.1" }, "permanent"],
    [{ status: "5.1.2" }, "permanent"],
    [{ status: "5.1.3" }, "permanent"],
    [{ status: "5.1.6" }, "permanent"],
    [{ status: "5.1.10" }, "permanent"],
    [{ status: "5.2.1" }, "permanent"],
    [{ status: "5.4.1", diagnostic: "Recipient address rejected: Access denied" }, "permanent"],
    [{ status: "5.5.0", diagnostic: "550 Requested action not taken: mailbox unavailable" }, "permanent"],
    [{ status: "5.2.3" }, "permanent_message"],
    [{ status: "5.2.2" }, "transient"],
    [{ status: "4.4.7" }, "transient"],
    [{ status: "4.2.1", action: "delayed" }, "transient"],
    [{ status: null, action: "delayed" }, "ignore"],
    [{ status: "5.7.1" }, "policy"],
    [{ status: "5.7.26" }, "policy"],
    [{ status: "5.3.4", diagnostic: "Blocked by reputation filter" }, "policy"],
    [{ status: "5.3.4", diagnostic: "message too big" }, "ignore"],
    [{ status: "5.4.1", diagnostic: "Access denied" }, "ignore"],
    [{ status: "5.5.0", diagnostic: "syntax error" }, "ignore"],
    [{ status: null, diagnostic: null }, "ignore"],
    [{ status: null, diagnostic: "User unknown" }, "permanent"],
    [{ status: null, diagnostic: "The account does not exist" }, "permanent"],
  ] as [Partial<DsnDetails>, string][])("%j -> %s", (over, expected) => {
    expect(classifyDsn(dsn(over))).toBe(expected);
  });

  it("treats a delayed action as transient even with a 5.x status", () => {
    expect(classifyDsn(dsn({ action: "delayed", status: "5.1.1" }))).toBe("transient");
  });

  it("prefers a dead address over policy words in the diagnostic", () => {
    expect(classifyDsn(dsn({ status: "5.1.1", diagnostic: "User unknown (spam filter)" }))).toBe("permanent");
  });
});
