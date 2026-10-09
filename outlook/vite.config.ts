import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

import { manifestPlugin } from "./manifest.ts";

// Pure modules shared with the Chrome extension, imported from source
export const alias = {
  "@ext": fileURLToPath(new URL("../extension/src/lib", import.meta.url)),
  "@extui": fileURLToPath(new URL("../extension/src/ui", import.meta.url)),
};

// Absolute, so both builds land in the same place whatever their root
export function outDir() {
  return resolve(process.env.OUTLOOK_OUT_DIR ?? fileURLToPath(new URL("./dist", import.meta.url)));
}

// The task pane (a normal page). The event runtime is built by vite.commands.config.ts.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const origin = new URL(env.VITE_APP_ORIGIN).origin;
  return {
    root: "src",
    base: "/outlook/",
    publicDir: fileURLToPath(new URL("./public", import.meta.url)),
    envDir: process.cwd(),
    resolve: { alias },
    plugins: [manifestPlugin({ origin, id: env.VITE_ADDIN_ID, mode })],
    build: {
      outDir: outDir(),
      emptyOutDir: true,
      rollupOptions: { input: { taskpane: "src/taskpane.html" } },
    },
  };
});
