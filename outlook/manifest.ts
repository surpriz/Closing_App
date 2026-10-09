import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

import pkg from "./package.json" with { type: "json" };

// Office wants four-part versions
export function addinVersion(version: string) {
  return [...version.split("."), "0", "0", "0"].slice(0, 4).join(".");
}

export function renderManifest(template: string, env: { origin: string; id: string; mode: string; version: string }) {
  const values: Record<string, string> = {
    ID: env.id,
    VERSION: addinVersion(env.version),
    ORIGIN: env.origin,
    BASE: `${env.origin}/outlook`,
    // Staging and local add-ins can sit next to the real one in the same Outlook
    SUFFIX: env.mode === "production" ? "" : env.mode === "staging" ? " (staging)" : " (dev)",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`manifest: unknown placeholder ${key}`);
    return values[key];
  });
}

// Emits manifest.xml next to the add-in pages, pointing at the origin this build serves from
export function manifestPlugin(env: { origin: string; id: string; mode: string }): Plugin {
  return {
    name: "clozer-outlook-manifest",
    generateBundle() {
      const template = readFileSync(fileURLToPath(new URL("./manifest/manifest.xml", import.meta.url)), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "manifest.xml",
        source: renderManifest(template, { ...env, version: pkg.version }),
      });
    },
  };
}
