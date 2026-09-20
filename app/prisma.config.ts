import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct (non pooled) Neon connection. Not using env()
    // because it throws when unset, which breaks `prisma generate` on install.
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
