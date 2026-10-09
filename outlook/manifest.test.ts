// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { addinVersion, renderManifest } from "./manifest.ts";

const template = readFileSync(fileURLToPath(new URL("./manifest/manifest.xml", import.meta.url)), "utf8");

describe("manifest", () => {
  const xml = renderManifest(template, { origin: "https://app.clozer.club", id: "6352200e-6950-46a5-9623-8132438db368", mode: "production", version: "0.1.0" });

  it("fills every placeholder", () => {
    expect(xml).not.toMatch(/\{\{/);
    expect(xml).toContain("<Id>6352200e-6950-46a5-9623-8132438db368</Id>");
    expect(xml).toContain("<Version>0.1.0.0</Version>");
    expect(xml).toContain('<DisplayName DefaultValue="Clozer"/>');
    expect(xml).toContain('DefaultValue="https://app.clozer.club/outlook/commands.js"');
  });

  it("names non-production add-ins so they can sit side by side", () => {
    expect(renderManifest(template, { origin: "https://staging.clozer.club", id: "x", mode: "staging", version: "0.1.0" })).toContain(
      '<DisplayName DefaultValue="Clozer (staging)"/>',
    );
  });

  it("wires the notice action to the compose button", () => {
    const commands = readFileSync(fileURLToPath(new URL("./src/commands/commands.ts", import.meta.url)), "utf8");
    const button = commands.match(/COMPOSE_BUTTON = "(\w+)"/)?.[1];
    expect(button).toBeTruthy();
    expect(xml).toContain(`id="${button}"`);
    expect(xml).toContain('FunctionName="onAttachmentsChanged"');
    expect(xml).toContain('FunctionName="onMessageSend"');
    expect(commands).toContain('associate("onAttachmentsChanged"');
    expect(commands).toContain('associate("onMessageSend"');
  });

  it("uses four-part versions", () => {
    expect(addinVersion("1.2.3")).toBe("1.2.3.0");
    expect(addinVersion("1")).toBe("1.0.0.0");
  });
});
