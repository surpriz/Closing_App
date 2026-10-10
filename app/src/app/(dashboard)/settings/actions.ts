"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSafeOutboundUrl } from "@/lib/closing/channels/webhooks";
import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { OFFER_DESCRIPTION_MAX } from "@/lib/onboarding";
import { isManagerRole } from "@/lib/roles";
import { requireManager, requireWorkspace } from "@/lib/session";

export type SettingsState = { ok?: boolean; error?: string } | null;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

// Only what the seller decides. Timing and limits are the pilot's job: their
// columns keep the defaults the analysis policy reads.
const settingsSchema = z.object({
  alertChannels: z.array(z.enum(["EMAIL", "SLACK", "WEBHOOK"])),
  alertEmail: z.union([z.literal(""), z.email()]).transform((v) => v || null),
  slackWebhookUrl: z.union([
    z.literal(""),
    z.url().refine((v) => v.startsWith("https://hooks.slack.com/"), "URL Slack invalide"),
  ]),
  removeSlack: z.boolean(),
  outboundWebhookUrl: z
    .union([z.literal(""), z.url().refine(isSafeOutboundUrl, "URL de webhook non autorisée")])
    .transform((v) => v || null),
  aiTone: optionalText(300),
  senderName: optionalText(80),
  senderSignature: optionalText(500),
  autonomy: z.enum(["COPILOT", "AUTOPILOT"]),
  chatEnabledByDefault: z.boolean(),
  assistantKnowledge: optionalText(4000),
  offerDescription: optionalText(OFFER_DESCRIPTION_MAX),
  targetCustomer: optionalText(500),
  valueProps: optionalText(1500),
  commonObjections: optionalText(1500),
  avgSalesCycleDays: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(1).max(730).nullable()),
});

// The signed-in seller's own notifications, saved with the same form
const prefsSchema = z.object({
  emailActions: z.boolean(),
  emailCallMoments: z.boolean(),
  extensionCallMoments: z.boolean(),
  morningDigest: z.boolean(),
  digestHour: z.coerce.number().int().min(0).max(23),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => tz === "" || isValidTimezone(tz))
    .transform((tz) => tz || undefined),
});

function isValidTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export async function saveWorkspaceSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { user, organization, role } = await requireWorkspace();

  const prefs = prefsSchema.safeParse({
    emailActions: formData.get("emailActions") === "on",
    emailCallMoments: formData.get("emailCallMoments") === "on",
    extensionCallMoments: formData.get("extensionCallMoments") === "on",
    morningDigest: formData.get("morningDigest") === "on",
    digestHour: String(formData.get("digestHour") ?? "8"),
    timezone: String(formData.get("timezone") ?? ""),
  });
  if (!prefs.success) return { error: "Réglages de notification invalides." };

  // A plain member only owns their notifications. Their workspace fields are
  // disabled, so not even sent: parsing them would wipe the saved values.
  if (!isManagerRole(role)) {
    await upsertSellerPrefs(user.id, organization.id, prefs.data);
    revalidatePath("/settings");
    return { ok: true };
  }

  const current = await getWorkspaceSettings(organization.id);
  const parsed = settingsSchema.safeParse({
    alertChannels: formData.getAll("alertChannels"),
    alertEmail: String(formData.get("alertEmail") ?? "").trim(),
    slackWebhookUrl: String(formData.get("slackWebhookUrl") ?? "").trim(),
    removeSlack: formData.get("removeSlack") === "on",
    outboundWebhookUrl: String(formData.get("outboundWebhookUrl") ?? "").trim(),
    aiTone: String(formData.get("aiTone") ?? ""),
    senderName: String(formData.get("senderName") ?? ""),
    senderSignature: String(formData.get("senderSignature") ?? ""),
    autonomy: String(formData.get("autonomy") ?? "COPILOT"),
    chatEnabledByDefault: formData.get("chatEnabledByDefault") === "on",
    assistantKnowledge: String(formData.get("assistantKnowledge") ?? ""),
    offerDescription: String(formData.get("offerDescription") ?? ""),
    targetCustomer: String(formData.get("targetCustomer") ?? ""),
    valueProps: String(formData.get("valueProps") ?? ""),
    commonObjections: String(formData.get("commonObjections") ?? ""),
    avgSalesCycleDays: String(formData.get("avgSalesCycleDays") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Paramètres invalides." };
  }

  const { slackWebhookUrl, removeSlack, ...values } = parsed.data;

  // Empty Slack field keeps the saved URL; only "remove" clears it
  const slack = removeSlack ? null : slackWebhookUrl ? encryptSecret(slackWebhookUrl) : current.slackWebhookUrl;
  // A signing secret is created the first time a webhook URL is set
  const webhookSecret =
    values.outboundWebhookUrl && !current.webhookSecret
      ? encryptSecret(randomBytes(24).toString("hex"))
      : current.webhookSecret;

  await prisma.workspaceSettings.update({
    where: { organizationId: organization.id },
    // Saving means the seller has seen the offer: it is no longer a guess
    data: { ...values, slackWebhookUrl: slack, webhookSecret, offerInferredFrom: null },
  });
  await upsertSellerPrefs(user.id, organization.id, prefs.data);
  if (current.autonomy === "AUTOPILOT" && values.autonomy === "COPILOT") {
    await backToApproval(organization.id);
  }

  revalidatePath("/settings");
  return { ok: true };
}

// Back to copilot: what was queued under autopilot waits for the seller again
async function backToApproval(organizationId: string) {
  await prisma.followup.updateMany({
    where: { link: { organizationId }, status: "GENERATED", approvedAt: null },
    data: { status: "DRAFT" },
  });
}

/** The dashboard's "pause" switch: stop sending alone right now, keep everything as drafts. Workspace-wide, so managers only. */
export async function pauseAutopilot() {
  const { organization } = await requireManager();
  await prisma.workspaceSettings.update({ where: { organizationId: organization.id }, data: { autonomy: "COPILOT" } });
  await backToApproval(organization.id);
  revalidatePath("/", "layout");
}

