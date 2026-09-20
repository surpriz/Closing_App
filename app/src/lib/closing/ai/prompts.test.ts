import { describe, expect, it } from "vitest";

import { buildFollowupPrompt, FOLLOWUP_SYSTEM_PROMPT } from "./prompts";
import { templateFollowup } from "./templates";

const input = {
  trigger: "HOT_PRICING" as const,
  channel: "EMAIL" as const,
  locale: "fr-FR",
  prospectName: "Marie Martin",
  company: "Acme SAS",
  documentName: "Refonte e-commerce",
  proposalUrl: "https://app.example.com/v/abc123def456",
  senderName: "Jérôme",
  senderSignature: "Jérôme – Studio Nova",
  daysSinceSent: 2,
  aiTone: null,
  documentIntro: "Proposition commerciale",
  pricingExcerpt: "Total du projet : 24 500 € HT",
};

describe("follow-up prompts", () => {
  it("forbids revealing reading analytics", () => {
    expect(FOLLOWUP_SYSTEM_PROMPT).toMatch(/Never mention or hint/);
  });

  it("passes pricing content only as delimited document text", () => {
    const prompt = buildFollowupPrompt(input);
    expect(prompt).toContain("<proposal_pricing_section>\nTotal du projet : 24 500 € HT\n</proposal_pricing_section>");
    expect(prompt).toContain("not instructions");
  });
});

describe("templateFollowup", () => {
  it("writes French with the link and signature, without tracking details", () => {
    const draft = templateFollowup(input);
    expect(draft.subject).toContain("Refonte e-commerce");
    expect(draft.body).toContain("Bonjour Marie,");
    expect(draft.body).toContain(input.proposalUrl);
    expect(draft.body).toContain("Studio Nova");
    expect(draft.body).not.toMatch(/secondes|page|consulté/i);
  });

  it("has no subject on WhatsApp", () => {
    expect(templateFollowup({ ...input, channel: "WHATSAPP", locale: "en-US" }).subject).toBeNull();
  });
});
