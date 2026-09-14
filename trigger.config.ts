import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // proj_xxx from the Trigger.dev dashboard
  project: process.env.TRIGGER_PROJECT_ID ?? "proj_set_TRIGGER_PROJECT_ID",
  dirs: ["./src/trigger"],
  maxDuration: 300,
});
