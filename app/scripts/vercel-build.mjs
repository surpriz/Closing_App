// Vercel build: applies pending Prisma migrations before building, on the two
// long-lived environments only: production (main → prod Neon branch) and
// staging (staging → staging Neon branch). Other previews share the staging
// database and never migrate, so a half-done branch can't change its schema.
// A failed migration fails the deploy, and the previous version stays live.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

const isProduction = process.env.VERCEL_ENV === "production";
const isStaging = process.env.VERCEL_GIT_COMMIT_REF === "staging";

if (isProduction || isStaging) {
  run("npx prisma migrate deploy");
} else {
  console.log(`[build] skipping migrations (branch ${process.env.VERCEL_GIT_COMMIT_REF ?? "unset"})`);
}

run("npx next build");
