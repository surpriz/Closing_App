import { describe, expect, it } from "vitest";

import { deeplConfig, deeplCostMicroUsd, deeplTarget } from "./deepl";
import { fileTranslationStep } from "./file-translation";

const NOW = new Date("2026-10-18T10:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);

describe("fileTranslationStep", () => {
  it("starts a language never asked for", () => {
    expect(fileTranslationStep(null, NOW)).toBe("start");
  });

  it("serves a translation once stored", () => {
    expect(fileTranslationStep({ status: "DONE", deeplDocumentId: "d", updatedAt: ago(600) }, NOW)).toBe("serve");
  });

  it("asks DeepL about a job it has, until the job gets too old", () => {
    expect(fileTranslationStep({ status: "PENDING", deeplDocumentId: "d", updatedAt: ago(1) }, NOW)).toBe("poll");
    expect(fileTranslationStep({ status: "PENDING", deeplDocumentId: "d", updatedAt: ago(45) }, NOW)).toBe("start");
  });

  it("waits for an upload in progress, and takes over a dead one", () => {
    expect(fileTranslationStep({ status: "PENDING", deeplDocumentId: null, updatedAt: ago(0.5) }, NOW)).toBe("wait");
    expect(fileTranslationStep({ status: "PENDING", deeplDocumentId: null, updatedAt: ago(5) }, NOW)).toBe("start");
  });

  it("does not pay again for a failure right away", () => {
    expect(fileTranslationStep({ status: "FAILED", deeplDocumentId: null, updatedAt: ago(2) }, NOW)).toBe("failed");
    expect(fileTranslationStep({ status: "FAILED", deeplDocumentId: null, updatedAt: ago(20) }, NOW)).toBe("start");
  });
});

describe("deepl", () => {
  it("talks to the Free API with a Free key", () => {
    expect(deeplConfig("abc:fx")?.baseUrl).toBe("https://api-free.deepl.com");
    expect(deeplConfig("abc")?.baseUrl).toBe("https://api.deepl.com");
    expect(deeplConfig("")).toBeNull();
  });

  it("names the variants DeepL asks for", () => {
    expect(deeplTarget("en")).toBe("EN-US");
    expect(deeplTarget("pt")).toBe("PT-PT");
    expect(deeplTarget("de")).toBe("DE");
  });

  it("counts the minimum DeepL bills for a PDF", () => {
    expect(deeplCostMicroUsd(1200, 25)).toBe(1_250_000);
    expect(deeplCostMicroUsd(80_000, 25)).toBe(2_000_000);
    expect(deeplCostMicroUsd(null, 25)).toBe(1_250_000);
  });
});
