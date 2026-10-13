import { describe, expect, it } from "vitest";

import {
  isTestRead,
  isToolConnected,
  mailToolTip,
  ONBOARDING_STEPS,
  parseMailClient,
  shouldForceOnboarding,
  testLinkName,
  toolFor,
} from "./onboarding";

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

  it("suggests the missing tool on the share screen", () => {
    const none = { chrome: false, outlook: false };
    expect(mailToolTip("gmail", none)).toBe("chrome");
    expect(mailToolTip("outlook_desktop", none)).toBe("outlook_addin");
    expect(mailToolTip("gmail", { chrome: true, outlook: false })).toBeNull();
    expect(mailToolTip("other", none)).toBeNull();
    expect(mailToolTip(null, none)).toBe("unknown");
    expect(mailToolTip(null, { chrome: false, outlook: true })).toBeNull();
  });

  it("starts with the seller's own document, tools last", () => {
    expect(ONBOARDING_STEPS[0]).toBe("drop");
    expect(ONBOARDING_STEPS.at(-1)).toBe("daily");
  });

  it("counts the seller's own read of the test link, not a crawler's", () => {
    expect(isTestRead({ isBot: true, fromSeller: true })).toBe(true);
    expect(isTestRead({ isBot: false, fromSeller: false })).toBe(true);
    expect(isTestRead({ isBot: true, fromSeller: false })).toBe(false);
  });

  it("forces the tour only on a fresh, empty workspace", () => {
    expect(shouldForceOnboarding({ onboardingCompletedAt: null, documentCount: 0 })).toBe(true);
    expect(shouldForceOnboarding({ onboardingCompletedAt: new Date(), documentCount: 0 })).toBe(false);
    // Invited into a workspace already in use
    expect(shouldForceOnboarding({ onboardingCompletedAt: null, documentCount: 3 })).toBe(false);
  });

  it("names the test link after the document", () => {
    expect(testLinkName("Devis Acme.pdf")).toBe("Test · Devis Acme.pdf");
    expect(testLinkName("x".repeat(300))).toHaveLength(200);
  });
});
