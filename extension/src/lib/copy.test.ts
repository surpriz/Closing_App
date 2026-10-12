import { describe, expect, it } from "vitest";

import { COPY } from "./copy";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("copy", () => {
  it("has no empty string", () => {
    for (const text of strings(COPY)) expect(text.trim()).not.toBe("");
  });

  it("keeps notice actions within Outlook's 30 characters", () => {
    for (const action of [COPY.connect, COPY.replaceWithLink, COPY.seeLink]) expect(action.length).toBeLessThanOrEqual(30);
  });

  it("uses no em dash", () => {
    for (const text of strings(COPY)) expect(text).not.toContain("—");
  });

  it("names the seller's address in the connected line", () => {
    expect(COPY.connected("marie@acme.fr")).toBe("Connecté · marie@acme.fr");
  });
});
