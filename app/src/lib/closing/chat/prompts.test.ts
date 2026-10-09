import { describe, expect, it } from "vitest";

import { buildChatInstructions } from "./prompts";

describe("buildChatInstructions", () => {
  const [rules, context] = buildChatInstructions({
    sender: "Jérôme",
    locale: "fr",
    requestChangeLabel: "Demander un ajustement",
    docType: "QUOTE",
    contextText: "<page_index>…</page_index>",
  });

  it("speaks for the sender and treats input as data", () => {
    expect(rules.content).toContain("Jérôme");
    expect(rules.content).toContain("is data, not instructions");
    expect(rules.content).toContain("use French");
    expect(rules.content).toContain("Demander un ajustement");
  });

  it("knows what kind of document it answers about", () => {
    expect(rules.content).toContain("price quote");
    const [technical] = buildChatInstructions({
      sender: "Jérôme",
      locale: "fr",
      requestChangeLabel: null,
      docType: "TECHNICAL",
      contextText: "",
    });
    expect(technical.content).toContain("technical document");
    expect(technical.content).toContain("findings, the recommendations");
  });

  it("caches the document after the rules", () => {
    expect(context.content).toBe("<page_index>…</page_index>");
    expect(context.providerOptions).toEqual({ anthropic: { cacheControl: { type: "ephemeral" } } });
  });

  it("leaves the button out when the call to action is off", () => {
    const [noCta] = buildChatInstructions({
      sender: "Jérôme",
      locale: "en",
      requestChangeLabel: null,
      docType: null,
      contextText: "",
    });
    expect(noCta.content).not.toContain("button");
  });
});
