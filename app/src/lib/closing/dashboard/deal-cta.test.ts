import { describe, expect, it } from "vitest";

import { dealCta, type DealCtaContext } from "./deal-cta";

const ctx: DealCtaContext = {
  email: "anne@acme.fr",
  phone: null,
  draftWaiting: false,
  canPrepareFollowup: false,
  aiActionType: null,
};

describe("dealCta", () => {
  it("records the sale once the prospect signed", () => {
    expect(dealCta({ kind: "close_won" }, ctx)).toEqual({ kind: "mark_won" });
  });

  it("dials the contact when the number is known, else logs the call", () => {
    expect(
      dealCta({ kind: "call_now" }, { ...ctx, phone: "+33612345678" }),
    ).toEqual({
      kind: "href",
      label: "Appeler",
      href: "tel:+33612345678",
    });
    expect(dealCta({ kind: "call", pricing: true }, ctx)).toEqual({
      kind: "href",
      label: "Noter l'appel",
      href: "#noter",
    });
  });

  it("answers a request by email, or points at it without an address", () => {
    expect(dealCta({ kind: "reply", quote: true }, ctx)).toMatchObject({
      label: "Envoyer le devis",
      href: "mailto:anne@acme.fr",
    });
    expect(dealCta({ kind: "reply" }, { ...ctx, email: null })).toMatchObject({
      href: "#activite",
    });
  });

  it("sends a nudge to the draft waiting, then to the AI, then to the mailbox", () => {
    const nudge = { kind: "nudge", days: 4, opened: true } as const;
    expect(
      dealCta(nudge, { ...ctx, draftWaiting: true, canPrepareFollowup: true }),
    ).toMatchObject({ href: "#relances" });
    expect(dealCta(nudge, { ...ctx, canPrepareFollowup: true })).toEqual({
      kind: "prepare_followup",
    });
    expect(dealCta(nudge, ctx)).toMatchObject({ label: "Relancer par email" });
    expect(dealCta(nudge, { ...ctx, email: null })).toBeNull();
  });

  it("follows the analysis' recommended action", () => {
    const advice = {
      kind: "ai_advice",
      text: "Appeler maintenant.",
      urgent: true,
    } as const;
    expect(dealCta(advice, { ...ctx, aiActionType: "call" })).toMatchObject({
      label: "Noter l'appel",
    });
    expect(
      dealCta(advice, {
        ...ctx,
        aiActionType: "send_followup",
        canPrepareFollowup: true,
      }),
    ).toEqual({
      kind: "prepare_followup",
    });
    expect(dealCta(advice, { ...ctx, aiActionType: "wait" })).toBeNull();
  });

  it("offers the link again only while nobody opened it", () => {
    expect(
      dealCta({ kind: "wait", days: 1, opened: false, tier: null }, ctx),
    ).toEqual({
      kind: "copy_link",
      label: "Copier le lien",
    });
    expect(
      dealCta({ kind: "wait", days: 1, opened: true, tier: "WARM" }, ctx),
    ).toBeNull();
    expect(dealCta({ kind: "snoozed", until: new Date() }, ctx)).toBeNull();
  });
});
