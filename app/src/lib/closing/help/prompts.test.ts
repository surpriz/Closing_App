import { describe, expect, it } from "vitest";

import { buildHelpInstructions, helpRules } from "./prompts";

describe("helpRules", () => {
  it("keeps the assistant on the guide and asks before sending anything", () => {
    const rules = helpRules("fr");
    expect(rules).toContain("Answer only from <clozer_guide>");
    expect(rules).toContain("Always ask the user first");
    expect(rules).toContain("send_to_team");
  });

  it("names the screens in the user's language", () => {
    expect(helpRules("fr")).toContain("Réglages → Réglages avancés → Liens et relances");
    expect(helpRules("fr")).toContain('Use "vous"');
    expect(helpRules("en")).toContain("Settings → Advanced settings → Links and follow-ups");
    expect(helpRules("en")).toContain("English by default");
  });
});

describe("buildHelpInstructions", () => {
  const [rules, guide, context] = buildHelpInstructions({
    guide: "## Documents",
    contextText: "<user_state>x</user_state>",
    locale: "fr",
  });

  it("puts the stable parts first and caches up to the guide", () => {
    expect(rules.content).toBe(helpRules("fr"));
    expect(guide.content).toBe("<clozer_guide>\n## Documents\n</clozer_guide>");
    expect(guide.providerOptions?.anthropic).toEqual({ cacheControl: { type: "ephemeral" } });
  });

  it("ends with the user's state, outside the cache", () => {
    expect(context.content).toBe("<user_state>x</user_state>");
    expect(context.providerOptions).toBeUndefined();
  });
});
