import { z } from "zod";

// Only what the app can't run without is required. Providers (email, AI,
// WhatsApp, Trigger.dev) are optional and features degrade when missing.
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  IP_HASH_SALT: z.string().min(16),
  DEFAULT_TIMEZONE: z.string().default("Europe/Paris"),

  RESEND_API_KEY: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().optional(),
  FOLLOWUP_EMAIL_FROM: z.string().optional(),
  FOLLOWUP_EMAIL_REPLY_TO: z.string().optional(),

  AI_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_FOLLOWUP: z.string().optional(),
  AI_MODEL_CHAT: z.string().optional(),
  AI_MODEL_CLASSIFY: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_WHATSAPP_TEMPLATE_SID_FOLLOWUP: z.string().optional(),

  TRIGGER_SECRET_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

// Parsed on first use, not at import time, so builds don't need every secret
export function getEnv(): ServerEnv {
  if (!cached) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Invalid server env:\n${z.prettifyError(result.error)}`);
    }
    cached = result.data;
  }
  return cached;
}
