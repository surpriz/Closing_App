import { describe, expect, it } from "vitest";

import { canForward, containsLink, decideRecipient, forwardTreeParent } from "./rules";

describe("canForward", () => {
  it("is open on a personal link, closed on shared links and onboarding tests", () => {
    expect(canForward({ shared: false, isOnboardingTest: false })).toBe(true);
    expect(canForward({ shared: true, isOnboardingTest: false })).toBe(false);
    expect(canForward({ shared: false, isOnboardingTest: true })).toBe(false);
  });
});

describe("decideRecipient", () => {
  const base = { fromEmail: "paul@acme.fr", toEmail: "marie@acme.fr", recipientIsMember: false, recipientOptedOut: false };

  it("accepts a new colleague", () => {
    expect(decideRecipient(base)).toBeNull();
  });

  it("refuses the reader's own address, whatever its case", () => {
    expect(decideRecipient({ ...base, toEmail: " Paul@ACME.fr" })).toBe("self");
  });

  it("refuses the seller's team and opted-out addresses", () => {
    expect(decideRecipient({ ...base, recipientIsMember: true })).toBe("seller");
    expect(decideRecipient({ ...base, recipientOptedOut: true })).toBe("unavailable");
  });
});

describe("containsLink", () => {
  it("catches urls and bare domains", () => {
    expect(containsLink("voir https://evil.test")).toBe(true);
    expect(containsLink("va sur www.promo")).toBe(true);
    expect(containsLink("clique sur gagner-un-iphone.com vite")).toBe(true);
  });

  it("lets ordinary notes through", () => {
    expect(containsLink("Peux-tu regarder le tarif p. 4 ? On en parle à 14h.")).toBe(false);
    expect(containsLink("La v2.0 du devis, 12.5% de remise. M. Dupont valide.")).toBe(false);
  });
});

describe("forwardTreeParent", () => {
  const fresh = { id: "to", origin: "FORWARDED" as const, forwardedById: null };
  const none = new Map<string, string | null>();

  it("links a new recipient to the forwarder", () => {
    expect(forwardTreeParent(fresh, "from", none)).toBe("from");
  });

  it("adopts a reader who arrived off Clozer", () => {
    expect(forwardTreeParent({ ...fresh, origin: "EMAIL_GATE" }, "from", none)).toBe("from");
  });

  it("never moves the seller's contact, an existing edge, or the forwarder itself", () => {
    expect(forwardTreeParent({ ...fresh, origin: "SELLER" }, "from", none)).toBeNull();
    expect(forwardTreeParent({ ...fresh, forwardedById: "other" }, "from", none)).toBeNull();
    expect(forwardTreeParent({ ...fresh, id: "from" }, "from", none)).toBeNull();
    expect(forwardTreeParent(fresh, null, none)).toBeNull();
  });

  it("never makes a loop when someone forwards back up the chain", () => {
    // A (off Clozer) -> B -> C, then C forwards to A
    const parentOf = new Map<string, string | null>([["A", null], ["B", "A"], ["C", "B"]]);
    expect(forwardTreeParent({ id: "A", origin: "EMAIL_GATE", forwardedById: null }, "C", parentOf)).toBeNull();
  });
});
