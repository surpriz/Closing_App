import { describe, expect, it } from "vitest";

import { findTrackingHint } from "@/lib/closing/ai/guard";

import { buildOutreachPrompt, OUTREACH_SYSTEM_PROMPT, outreachFooter, templateOutreach, type OutreachInput } from "./hook-prompt";
import { pickReference } from "./reference";

const input: OutreachInput = {
  prospect: { firstName: "Marie", title: "CEO", company: "Acme" },
  offer: { description: "la refonte de sites e-commerce", valueProps: null, targetCustomer: null },
  documentTitle: "Présentation Studio Nord",
  proposalUrl: "https://app.clozer.club/v/abc",
  senderName: "Paul",
  signature: null,
  reference: null,
};

describe("outreach prompt", () => {
  it("forbids any hint of tracking and of where the contact came from", () => {
    expect(OUTREACH_SYSTEM_PROMPT).toContain("Never mention or hint that you know anything about how the prospect behaves");
    expect(OUTREACH_SYSTEM_PROMPT).toContain("never mention a data provider");
  });

  it("only names a customer given as reference", () => {
    expect(OUTREACH_SYSTEM_PROMPT).toContain("Name a customer only if a <reference> tag is present");
    expect(buildOutreachPrompt(input)).not.toContain("<reference>");
    expect(buildOutreachPrompt({ ...input, reference: "Globex" })).toContain("<reference>\nGlobex\n</reference>");
  });
});

describe("templateOutreach", () => {
  it("never hints at tracking and keeps the link", () => {
    const draft = templateOutreach(input);
    expect(findTrackingHint(draft.body, {})).toBeNull();
    expect(draft.body).toContain(input.proposalUrl);
    expect(draft.body).not.toMatch(/Globex|notamment/);
  });

  it("names the reference only when there is one", () => {
    expect(templateOutreach({ ...input, reference: "Globex" }).body).toContain("Nous accompagnons notamment Globex.");
  });
});

describe("outreachFooter", () => {
  it("always says how to opt out", () => {
    expect(outreachFooter({ signature: null, senderName: "Paul", unsubscribeUrl: "https://x/u/t" })).toBe(
      "Paul\n\nVous recevez ce message car votre fonction correspond à notre activité. Pour ne plus être contacté : https://x/u/t",
    );
  });
});

describe("pickReference", () => {
  const now = new Date("2026-10-11T10:00:00Z");

  it("never picks a customer without consent", () => {
    expect(pickReference([{ company: "Globex", naf: "62.01Z", consentAt: null }], "62.01Z")).toBeNull();
  });

  it("prefers a consenting customer from the same sector", () => {
    expect(
      pickReference(
        [
          { company: "Initech", naf: "47.11F", consentAt: now },
          { company: "Globex", naf: "62.02A", consentAt: now },
          { company: "Umbrella", naf: "62.01Z", consentAt: null },
        ],
        "62.01Z",
      ),
    ).toBe("Globex");
    expect(pickReference([{ company: "Initech", naf: null, consentAt: now }], "62.01Z")).toBe("Initech");
  });
});
