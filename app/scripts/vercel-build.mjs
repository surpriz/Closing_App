// Vercel build: production deploys apply pending Prisma migrations to Neon
// before building. Preview deploys share the production database for now,
// so they never migrate. A failed migration fails the deploy, and the
// previous version stays live.
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
} else {
  console.log(`[build] skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}

run("npx next build");
