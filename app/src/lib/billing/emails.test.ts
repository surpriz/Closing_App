import { describe, expect, it } from "vitest";

import { buildBillingEmail, dueBillingEmail, type BillingEmailFacts } from "./emails";

const NOW = new Date("2026-11-10T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);

const FACTS: BillingEmailFacts = {
  trialEndsAt: null,
  betaGrace: false,
  betaGraceUntil: null,
  noticeDays: 30,
  subscribed: false,
  sent: new Set(),
};

describe("dueBillingEmail", () => {
  it("warns three days before the trial ends, then once it has", () => {
    expect(dueBillingEmail({ ...FACTS, trialEndsAt: later(5) }, NOW)).toBeNull();
    expect(dueBillingEmail({ ...FACTS, trialEndsAt: later(2) }, NOW)).toBe("billing_trial_ending");
    expect(dueBillingEmail({ ...FACTS, trialEndsAt: later(-1) }, NOW)).toBe("billing_trial_ended");
    expect(dueBillingEmail({ ...FACTS, trialEndsAt: later(-5) }, NOW)).toBeNull();
  });

  it("sends each email once", () => {
    expect(dueBillingEmail({ ...FACTS, trialEndsAt: later(2), sent: new Set(["billing_trial_ending"]) }, NOW)).toBeNull();
  });

  it("says nothing to a workspace that pays", () => {
    expect(dueBillingEmail({ ...FACTS, trialEndsAt: later(2), subscribed: true }, NOW)).toBeNull();
  });

  it("announces the end of the beta once the date is set, then a week before", () => {
    const beta = { ...FACTS, betaGrace: true };
    expect(dueBillingEmail(beta, NOW)).toBeNull();
    expect(dueBillingEmail({ ...beta, betaGraceUntil: later(60) }, NOW)).toBeNull();
    expect(dueBillingEmail({ ...beta, betaGraceUntil: later(20) }, NOW)).toBe("billing_beta_notice");
    expect(dueBillingEmail({ ...beta, betaGraceUntil: later(5), sent: new Set(["billing_beta_notice"]) }, NOW)).toBe(
      "billing_beta_ending",
    );
    expect(dueBillingEmail({ ...beta, betaGraceUntil: later(-1) }, NOW)).toBeNull();
  });

  it("keeps quiet about a trial while the beta grace runs", () => {
    expect(dueBillingEmail({ ...FACTS, betaGrace: true, trialEndsAt: later(2) }, NOW)).toBeNull();
  });
});

describe("buildBillingEmail", () => {
  it("writes each email in the owner's language with a link to billing", () => {
    for (const locale of ["en", "fr"] as const) {
      for (const kind of ["billing_trial_ending", "billing_trial_ended", "billing_beta_notice", "billing_beta_ending", "billing_payment_failed"] as const) {
        const email = buildBillingEmail(kind, { appUrl: "https://app.test", firstName: "Ana", locale, endsAt: later(2), now: NOW });
        expect(email.subject).not.toMatch(/\{|billing\./);
        expect(email.text).toContain("https://app.test/settings#facturation");
        expect(email.html).toContain("Ana");
      }
    }
  });

  it("adds the campaign discount to the trial-ending email only when asked", () => {
    const data = { appUrl: "https://app.test", firstName: "Ana", locale: "fr", endsAt: later(2), now: NOW } as const;
    expect(buildBillingEmail("billing_trial_ending", { ...data, offer: true }).html).toContain("30 %");
    expect(buildBillingEmail("billing_trial_ending", { ...data, offer: false }).html).not.toContain("30 %");
  });
});
