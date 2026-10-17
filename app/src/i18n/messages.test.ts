import { describe, expect, it } from "vitest";

import { MESSAGES } from "./messages";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

describe("messages", () => {
  it("has the same keys in every language", () => {
    expect(keys(MESSAGES.fr).sort()).toEqual(keys(MESSAGES.en).sort());
  });

  it("has no empty string", () => {
    for (const messages of Object.values(MESSAGES)) {
      const empty = keys(messages).filter((key) => key.split(".").reduce<unknown>((node, k) => (node as Record<string, unknown>)[k], messages) === "");
      expect(empty).toEqual([]);
    }
  });
});
