// Vercel build: applies pending Prisma migrations before building, on the two
// long-lived environments only: production (main → prod Neon branch) and
// staging (staging → staging Neon branch). Other previews share the staging
// database and never migrate, so a half-done branch can't change its schema.
// A failed migration fails the deploy, and the previous version stays live.
import { execSync } from "node:child_process";

const run = (command, options = {}) => execSync(command, { stdio: "inherit", ...options });

const isProduction = process.env.VERCEL_ENV === "production";
const isStaging = process.env.VERCEL_GIT_COMMIT_REF === "staging";

if (isProduction || isStaging) {
  run("npx prisma migrate deploy");
} else {
  console.log(`[build] skipping migrations (branch ${process.env.VERCEL_GIT_COMMIT_REF ?? "unset"})`);
}

// The Outlook add-in (../outlook) is served by the app under /outlook, same origin as /api/ext.
// Needs "Include files outside the root directory" on the Vercel project (on by default).
run(
  `npm ci --prefix ../outlook && npm run ${isProduction ? "build" : "build:staging"} --prefix ../outlook`,
  { env: { ...process.env, OUTLOOK_OUT_DIR: new URL("../public/outlook", import.meta.url).pathname } },
);

run("npx next build");
