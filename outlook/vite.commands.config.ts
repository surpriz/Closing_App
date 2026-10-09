import { defineConfig } from "vite";

import { alias, outDir, tsconfig } from "./vite.config.ts";

// Event handlers (attachment added, send). Classic Outlook on Windows runs them in a
// JavaScript-only runtime that loads one plain script, so: a single IIFE, no modules.
export default defineConfig({
  envDir: process.cwd(),
  tsconfig,
  resolve: { alias },
  publicDir: false,
  build: {
    outDir: outDir(),
    emptyOutDir: false,
    target: "es2017",
    lib: { entry: "src/commands/commands.ts", formats: ["iife"], name: "ClozerCommands", fileName: () => "commands.js" },
  },
});
