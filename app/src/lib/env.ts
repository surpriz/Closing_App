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
  CRON_SECRET: z.string().min(32).optional(),

  SES_REGION: z.string().optional(),
  SES_ACCESS_KEY_ID: z.string().optional(),
  SES_SECRET_ACCESS_KEY: z.string().optional(),
  SES_CONFIGURATION_SET: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().optional(),
  FOLLOWUP_EMAIL_FROM: z.string().optional(),
  FOLLOWUP_EMAIL_REPLY_TO: z.string().optional(),
  // ?token= on the SNS subscriptions of /api/webhooks/ses (deliveries, bounces) and /api/webhooks/ses-inbound (replies)
  SES_WEBHOOK_TOKEN: z.string().min(24).optional(),
  // Replies to Clozer emails go to r-<id>@<this domain> (MX to SES inbound), are logged, then passed to the seller.
  // Unset: replies go straight to the seller, and Clozer only learns of them through the extension
  INBOUND_REPLY_DOMAIN: z.string().optional(),
  // The S3 bucket the SES receipt rule writes the replies to, read with the SES_* credentials
  INBOUND_REPLY_BUCKET: z.string().optional(),

  // Never fatal: see resolveAiProvider. The raw value is normalised once the keys are known (below)
  AI_PROVIDER: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL_FOLLOWUP: z.string().optional(),
  AI_MODEL_CHAT: z.string().optional(),
  AI_MODEL_CLASSIFY: z.string().optional(),
  AI_MODEL_ANALYZE: z.string().optional(),
  AI_MODEL_HELP: z.string().optional(),
  AI_MODEL_TRANSLATE: z.string().optional(),
  AI_MODEL_TRANSCRIBE: z.string().optional(),
  // Deal analyses per workspace per day, and AI spend per day across all workspaces
  AI_BRAIN_DAILY_LIMIT: z.coerce.number().int().min(0).default(200),
  AI_DAILY_BUDGET_USD: z.coerce.number().min(0).default(20),
  AI_CHAT_DAILY_LIMIT: z.coerce.number().int().min(0).default(300),
  AI_CHAT_DAILY_BUDGET_USD: z.coerce.number().min(0).default(10),
  // Help assistant for users, across all workspaces, USD per day
  AI_HELP_DAILY_BUDGET_USD: z.coerce.number().min(0).default(5),
  // Documents translated for readers, per workspace, USD per day. Each document is paid once per language
  AI_TRANSLATE_DAILY_BUDGET_USD: z.coerce.number().min(0).default(20),
  // PDFs are translated by DeepL, layout kept. A key ending in ":fx" is a Free plan key
  DEEPL_API_KEY: z.string().optional(),
  DEEPL_PRICE_PER_MILLION_USD: z.coerce.number().min(0).default(25),
  // Where the help assistant sends users' suggestions, bugs and unanswered questions. Unset: stored only
  HELP_INBOX_EMAIL: z.preprocess((value) => value || undefined, z.email().optional()),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_WHATSAPP_TEMPLATE_SID_FOLLOWUP: z.string().optional(),

  TRIGGER_SECRET_KEY: z.string().optional(),

  // Browser extension: allowed IDs (comma-separated) and a remote kill switch.
  // EXTENSION_DISABLED_HOSTS takes "gmail", "outlook" (Outlook web) and "outlook-addin" (Outlook for Windows / Mac)
  EXTENSION_IDS: z.string().optional(),
  EXTENSION_MIN_VERSION: z.string().optional(),
  EXTENSION_DISABLED_HOSTS: z.string().optional(),
  EXTENSION_NOTIFICATIONS_DISABLED: z.enum(["true", "false"]).optional(),
  // Chrome Web Store page, linked from the welcome tour. Unset until the extension is published
  EXTENSION_STORE_URL: z.preprocess((value) => value || undefined, z.url().optional()),
  // Time travel and manual engine runs; ignored in production
  ENABLE_TEST_TOOLS: z.enum(["true", "false"]).optional(),

  // Prospecting POC: provider licences are internal-use only, so it is on for listed workspaces only
  PROSPECTING_ORG_IDS: z.string().optional(),
  APOLLO_API_KEY: z.string().optional(),
  LEMLIST_API_KEY: z.string().optional(),
  PROSPECTING_DAILY_REVEAL_LIMIT: z.coerce.number().int().min(0).default(50),
  PROSPECTING_MOCK: z.enum(["true", "false"]).optional(),

  // Native cold email (outreach)
  // Native cold email: workspaces allowed to connect a mailbox and run campaigns (comma-separated org ids, or `*` for
  // every workspace; the plan gate still applies). Unset: nothing runs (kill switch).
  OUTREACH_ORG_IDS: z.string().optional(),
  // Gmail goes through an intermediary that carries Google's verification; pinned on each mailbox at connect time
  GMAIL_CONNECTOR: z.enum(["unipile", "nylas"]).optional(),
  UNIPILE_DSN: z.preprocess((value) => value || undefined, z.url().optional()),
  UNIPILE_API_KEY: z.string().optional(),
  NYLAS_API_URL: z.preprocess((value) => value || undefined, z.url().default("https://api.eu.nylas.com")),
  NYLAS_CLIENT_ID: z.string().optional(),
  NYLAS_API_KEY: z.string().optional(),
  NYLAS_WEBHOOK_SECRET: z.string().optional(),
  MICROSOFT_MAILBOX_CLIENT_ID: z.string().optional(),
  MICROSOFT_MAILBOX_CLIENT_SECRET: z.string().optional(),
  // ?token= on the mailbox webhooks (/api/webhooks/mailboxes/*). 24+ characters
  MAILBOX_WEBHOOK_TOKEN: z.string().min(24).optional(),
  MAILBOX_DAILY_CAP_DEFAULT: z.coerce.number().int().min(1).default(30),
  MAILBOX_DAILY_CAP_MAX: z.coerce.number().int().min(1).default(50),

  // Billing: unset key means billing off and no plan limit (lib/billing/plans.ts)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Beta workspaces keep Team until then. Unset: not announced yet, the grace goes on
  BETA_GRACE_UNTIL: z.preprocess((value) => value || undefined, z.coerce.date().optional()),
  BETA_NOTICE_DAYS: z.coerce.number().int().min(1).default(30),
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
