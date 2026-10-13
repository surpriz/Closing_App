import { describe, expect, it } from "vitest";

import { buildOnboardingEmail, dueOnboardingEmail, type OnboardingFacts } from "./onboarding-emails";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-10-20T10:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);

function facts(overrides: Partial<OnboardingFacts> = {}): OnboardingFacts {
  return {
    joinedAt: ago(0),
    sent: new Set(),
    off: false,
    firstDocumentAt: null,
    hasSentLink: false,
    firstReadAt: null,
    ...overrides,
  };
}

describe("dueOnboardingEmail", () => {
  it("welcomes a new seller once", () => {
    expect(dueOnboardingEmail(facts(), now)).toBe("welcome");
    expect(dueOnboardingEmail(facts({ sent: new Set(["welcome"]) }), now)).toBeNull();
  });

  it("nudges a seller with no document after a day, within the first week", () => {
    const sent = new Set(["welcome"] as const);
    expect(dueOnboardingEmail(facts({ sent, joinedAt: ago(12) }), now)).toBeNull();
    expect(dueOnboardingEmail(facts({ sent, joinedAt: ago(30) }), now)).toBe("no_document");
    expect(dueOnboardingEmail(facts({ sent, joinedAt: ago(24 * 8) }), now)).toBeNull();
    expect(dueOnboardingEmail(facts({ sent, joinedAt: ago(30), firstDocumentAt: ago(2) }), now)).toBeNull();
  });

  it("reminds that a ready link has not gone out", () => {
    const base = { sent: new Set(["welcome"] as const), joinedAt: ago(72) };
    expect(dueOnboardingEmail(facts({ ...base, firstDocumentAt: ago(10) }), now)).toBeNull();
    expect(dueOnboardingEmail(facts({ ...base, firstDocumentAt: ago(50) }), now)).toBe("not_sent");
    expect(dueOnboardingEmail(facts({ ...base, firstDocumentAt: ago(50), hasSentLink: true }), now)).toBeNull();
  });

  it("celebrates the first real read first, only while it is fresh", () => {
    expect(dueOnboardingEmail(facts({ firstReadAt: ago(1) }), now)).toBe("first_read");
    expect(dueOnboardingEmail(facts({ joinedAt: ago(24 * 5), firstDocumentAt: ago(24 * 4), hasSentLink: true, firstReadAt: ago(24 * 3) }), now)).toBeNull();
  });

  it("stays quiet once the seller opted out", () => {
    expect(dueOnboardingEmail(facts({ off: true, firstReadAt: ago(1) }), now)).toBeNull();
  });
});

describe("buildOnboardingEmail", () => {
  it("names the prospect and links the deal", () => {
    const email = buildOnboardingEmail("first_read", {
      appUrl: "https://app.clozer.club",
      firstName: "Marie",
      deal: { label: "Acme", url: "https://app.clozer.club/links/l1" },
    });
    expect(email.subject).toBe("Acme a ouvert votre document");
    expect(email.html).toContain("https://app.clozer.club/links/l1");
    expect(email.text).toContain("Bonjour Marie,");
    expect(email.text).toContain("/bienvenue/emails");
  });

  it("falls back when the reader has no name", () => {
    const email = buildOnboardingEmail("first_read", {
      appUrl: "https://app.clozer.club",
      firstName: null,
      deal: { label: null, url: "https://app.clozer.club/links/l1" },
    });
    expect(email.subject).toBe("Un prospect a ouvert votre document");
  });
});
