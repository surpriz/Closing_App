import { describe, expect, it } from "vitest";

import {
  canInstallChromeExtension,
  extensionState,
  isExtensionNudgeSnoozed,
  isOlderVersion,
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

  it("offers the extension on desktop Chromium only", () => {
    const chromeMac =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    const edgeWin =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
    const safari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
    const firefox = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0";
    const chromeAndroid =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
    const chromeIos =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1";
    expect(canInstallChromeExtension(chromeMac)).toBe(true);
    expect(canInstallChromeExtension(edgeWin)).toBe(true);
    expect(canInstallChromeExtension(safari)).toBe(false);
    expect(canInstallChromeExtension(firefox)).toBe(false);
    expect(canInstallChromeExtension(chromeAndroid)).toBe(false);
    expect(canInstallChromeExtension(chromeIos)).toBe(false);
  });

  it("tells where this browser's extension stands", () => {
    const base = { userEmail: "Ada@acme.fr", minVersion: null, serverChrome: false };
    const reply = { version: "1.2.0", signedIn: true, email: "ada@acme.fr" };
    expect(extensionState({ ...base, reply })).toBe("ok");
    expect(extensionState({ ...base, reply: { ...reply, email: null } })).toBe("ok");
    expect(extensionState({ ...base, reply: { ...reply, signedIn: false, email: null } })).toBe("signed_out");
    expect(extensionState({ ...base, reply: { ...reply, email: "bob@acme.fr" } })).toBe("other_account");
    expect(extensionState({ ...base, minVersion: "1.3.0", reply })).toBe("outdated");
    // No answer: nothing installed, or a version too old to hear the app
    expect(extensionState({ ...base, reply: null })).toBe("absent");
    expect(extensionState({ ...base, reply: null, serverChrome: true })).toBe("ok");
  });

  it("compares extension versions", () => {
    expect(isOlderVersion("1.1.0", "1.2.0")).toBe(true);
    expect(isOlderVersion("1.10.0", "1.2.0")).toBe(false);
    expect(isOlderVersion("1.2", "1.2.0")).toBe(false);
  });

  it("brings the closed banner back after a week", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(isExtensionNudgeSnoozed(null, now)).toBe(false);
    expect(isExtensionNudgeSnoozed(new Date("2026-10-12T12:00:00Z"), now)).toBe(true);
    expect(isExtensionNudgeSnoozed(new Date("2026-10-09T12:00:00Z"), now)).toBe(false);
  });
});
