"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSafeOutboundUrl } from "@/lib/closing/channels/webhooks";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

export type SettingsState = { ok?: boolean; error?: string } | null;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const settingsSchema = z
  .object({
    defaultChannels: z.array(z.enum(["EMAIL", "WHATSAPP"])).min(1, "Choisissez au moins un canal de relance."),
    hotPricingThresholdSec: z.coerce.number().int().min(10).max(3600),
    inactivityDays: z
      .string()
      .transform((v) =>
        [...new Set(v.split(/[,;\s]+/).filter(Boolean).map(Number))].sort((a, b) => a - b),
      )
      .pipe(z.array(z.number().int().min(1).max(60)).min(1, "Indiquez au moins un délai.").max(5)),
    businessHourStart: z.coerce.number().int().min(0).max(23),
    businessHourEnd: z.coerce.number().int().min(1).max(24),
    multiViewerThreshold: z.coerce.number().int().min(1).max(20),
    reopenAfterInactivityDays: z.coerce.number().int().min(1).max(60),
    alertChannels: z.array(z.enum(["EMAIL", "SLACK", "WEBHOOK"])),
    alertEmail: z.union([z.literal(""), z.email()]).transform((v) => v || null),
    slackWebhookUrl: z
      .union([z.literal(""), z.url().refine((v) => v.startsWith("https://hooks.slack.com/"), "URL Slack invalide")]),
    removeSlack: z.boolean(),
    outboundWebhookUrl: z
      .union([z.literal(""), z.url().refine(isSafeOutboundUrl, "URL de webhook non autorisée")])
      .transform((v) => v || null),
    aiTone: optionalText(300),
    senderName: optionalText(80),
    senderSignature: optionalText(500),
  })
  .refine((s) => s.businessHourEnd > s.businessHourStart, {
    message: "L'heure de fin doit être après l'heure de début.",
  });

export async function saveWorkspaceSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { organization } = await requireWorkspace();
  const current = await getWorkspaceSettings(organization.id);

  const parsed = settingsSchema.safeParse({
    defaultChannels: formData.getAll("defaultChannels"),
    hotPricingThresholdSec: formData.get("hotPricingThresholdSec"),
    inactivityDays: String(formData.get("inactivityDays") ?? ""),
    businessHourStart: formData.get("businessHourStart"),
    businessHourEnd: formData.get("businessHourEnd"),
    multiViewerThreshold: formData.get("multiViewerThreshold"),
    reopenAfterInactivityDays: formData.get("reopenAfterInactivityDays"),
    alertChannels: formData.getAll("alertChannels"),
    alertEmail: String(formData.get("alertEmail") ?? "").trim(),
    slackWebhookUrl: String(formData.get("slackWebhookUrl") ?? "").trim(),
    removeSlack: formData.get("removeSlack") === "on",
    outboundWebhookUrl: String(formData.get("outboundWebhookUrl") ?? "").trim(),
    aiTone: String(formData.get("aiTone") ?? ""),
    senderName: String(formData.get("senderName") ?? ""),
    senderSignature: String(formData.get("senderSignature") ?? ""),
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
    data: { ...values, slackWebhookUrl: slack, webhookSecret },
  });

  revalidatePath("/settings");
  return { ok: true };
}
