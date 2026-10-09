import { defineConfig } from "vitest/config";

import { alias, tsconfig } from "./vite.config.ts";

export default defineConfig({
  tsconfig,
  resolve: { alias },
  test: { environment: "happy-dom", include: ["src/**/*.test.ts", "*.test.ts"] },
});
