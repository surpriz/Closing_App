import { describe, expect, it } from "vitest";

import { buildHelpInstructions, helpRules } from "./prompts";

describe("helpRules", () => {
  it("keeps the assistant on the guide and asks before sending anything", () => {
    const rules = helpRules();
    expect(rules).toContain("Answer only from <clozer_guide>");
    expect(rules).toContain("Always ask the user first");
    expect(rules).toContain("send_to_team");
  });
});

describe("buildHelpInstructions", () => {
  const [rules, guide, context] = buildHelpInstructions({ guide: "## Documents", contextText: "<user_state>x</user_state>" });

  it("puts the stable parts first and caches up to the guide", () => {
    expect(rules.content).toBe(helpRules());
    expect(guide.content).toBe("<clozer_guide>\n## Documents\n</clozer_guide>");
    expect(guide.providerOptions?.anthropic).toEqual({ cacheControl: { type: "ephemeral" } });
  });

  it("ends with the user's state, outside the cache", () => {
    expect(context.content).toBe("<user_state>x</user_state>");
    expect(context.providerOptions).toBeUndefined();
  });
});
