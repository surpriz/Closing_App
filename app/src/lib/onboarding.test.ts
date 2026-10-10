import { describe, expect, it } from "vitest";

import { isToolConnected, parseMailClient, toolFor } from "./onboarding";

describe("onboarding", () => {
  it("picks the tool for each mailbox", () => {
    expect(toolFor("gmail")).toBe("chrome");
    expect(toolFor("outlook_web")).toBe("chrome");
    expect(toolFor("outlook_desktop")).toBe("outlook_addin");
    expect(toolFor("other")).toBe("manual");
    expect(toolFor(null)).toBe("manual");
  });

  it("only accepts known mail clients", () => {
    expect(parseMailClient("gmail")).toBe("gmail");
    expect(parseMailClient("yahoo")).toBeNull();
    expect(parseMailClient(undefined)).toBeNull();
  });

  it("knows when the seller's tool is paired", () => {
    const none = { chrome: false, outlook: false };
    expect(isToolConnected("gmail", none)).toBe(false);
    expect(isToolConnected("gmail", { chrome: true, outlook: false })).toBe(true);
    expect(isToolConnected("outlook_desktop", { chrome: true, outlook: false })).toBe(false);
    expect(isToolConnected("outlook_desktop", { chrome: false, outlook: true })).toBe(true);
    expect(isToolConnected("other", none)).toBe(true);
  });
});
