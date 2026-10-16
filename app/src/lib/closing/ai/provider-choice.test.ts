import { describe, expect, it } from "vitest";

import { resolveAiProvider } from "./provider-choice";

describe("resolveAiProvider", () => {
  it("accepts spaces, case and claude", () => {
    expect(resolveAiProvider({ AI_PROVIDER: " Anthropic\n" })).toBe("anthropic");
    expect(resolveAiProvider({ AI_PROVIDER: "claude" })).toBe("anthropic");
    expect(resolveAiProvider({ AI_PROVIDER: "OpenAI" })).toBe("openai");
  });

  it("falls back on the provider that has a key", () => {
    expect(resolveAiProvider({ AI_PROVIDER: "antropic", ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
    expect(resolveAiProvider({ ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k" })).toBe("openai");
    expect(resolveAiProvider({})).toBe("openai");
  });
});
