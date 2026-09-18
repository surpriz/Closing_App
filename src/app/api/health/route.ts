import { timingSafeEqual } from "node:crypto";

import { getLanguageModel } from "@/lib/closing/ai/provider";
import { isWhatsAppConfigured } from "@/lib/closing/channels/whatsapp";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";

const REQUIRED = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "BLOB_READ_WRITE_TOKEN",
  "ENCRYPTION_KEY",
  "IP_HASH_SALT",
  "CRON_SECRET",
  "AUTH_EMAIL_FROM",
  "FOLLOWUP_EMAIL_FROM",
] as const;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Operational check: which settings are present (never their values) and
// whether the database answers. Protected by CRON_SECRET.
export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = error instanceof Error ? error.message.slice(0, 200) : "error";
  }

  const llm = getLanguageModel("followup");

  return Response.json({
    env: Object.fromEntries(REQUIRED.map((name) => [name, !!process.env[name]])),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    providers: {
      email: isEmailConfigured(),
      whatsapp: isWhatsAppConfigured(),
      ai: llm ? `${llm.provider}:${llm.modelId}` : null,
    },
    database,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
