"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getWorkspacePlan, upgradePrompt, type UpgradeReason } from "@/lib/billing/workspace-plan";
import { parseOptionalBookingUrl } from "@/lib/closing/booking/url";
import { isSafeOutboundUrl } from "@/lib/closing/channels/webhooks";
import { upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { getWorkspaceSettings } from "@/lib/closing/settings";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { OFFER_DESCRIPTION_MAX } from "@/lib/onboarding";
import { isManagerRole } from "@/lib/roles";
import { requireManager, requireWorkspace } from "@/lib/session";

/** `workspace`: the rejected field is one of the team's settings (they sit under the advanced fold). */
export type SettingsState = { ok?: boolean; error?: string; workspace?: boolean; upgrade?: UpgradeReason } | null;

// Textareas post line breaks as CRLF: counted once, as the browser's maxLength does
const optionalText = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n"))
    .pipe(z.string().trim().max(max))
    .transform((v) => v || null);

// Only what the seller decides. Timing and limits are the pilot's job: their
// columns keep the defaults the analysis policy reads.
const settingsSchema = z.object({
  alertChannels: z.array(z.enum(["EMAIL", "SLACK", "WEBHOOK"])),
  alertEmail: z.union([z.literal(""), z.email()]).transform((v) => v || null),
  slackWebhookUrl: z.union([
    z.literal(""),
    z.url().refine((v) => v.startsWith("https://hooks.slack.com/"), "invalidSlackUrl"),
  ]),
  removeSlack: z.boolean(),
  outboundWebhookUrl: z
    .union([z.literal(""), z.url().refine(isSafeOutboundUrl, "unsafeWebhookUrl")])
    .transform((v) => v || null),
  aiTone: optionalText(300),
  senderName: optionalText(80),
  senderSignature: optionalText(500),
  autonomy: z.enum(["COPILOT", "AUTOPILOT"]),
  chatEnabledByDefault: z.boolean(),
  voiceCommentsByDefault: z.boolean(),
  followupsByDefault: z.boolean(),
  quoteExpiryDays: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(1).max(365).nullable()),
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
  // Empty = no booking button on this seller's links
  bookingUrl: z.string().transform((v, ctx) => {
    const url = parseOptionalBookingUrl(v);
    if (url === undefined) ctx.addIssue({ code: "custom", message: "invalidBookingUrl" });
    return url ?? null;
  }),
});

// Schema messages are keys of settings.actions; anything else (zod's own) shows as is
type ActionsT = Awaited<ReturnType<typeof getTranslations<"settings.actions">>>;

function issueMessage(t: ActionsT, message: string | undefined, fallback: "invalidNotifications" | "invalidSettings") {
  if (!message) return t(fallback);
  return t.has(message as never) ? t(message as never) : message;
}

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
    bookingUrl: String(formData.get("bookingUrl") ?? ""),
  });
  if (!prefs.success) {
    const t = await getTranslations("settings.actions");
    return { error: issueMessage(t, prefs.error.issues[0]?.message, "invalidNotifications") };
  }

  // A plain member only owns their notifications. Their workspace fields are
  // disabled, so not even sent, and whatever they post here is ignored: parsing
  // absent fields would wipe the saved values.
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
    voiceCommentsByDefault: formData.get("voiceCommentsByDefault") === "on",
    followupsByDefault: formData.get("followupsByDefault") === "on",
    quoteExpiryDays: String(formData.get("quoteExpiryDays") ?? ""),
    assistantKnowledge: String(formData.get("assistantKnowledge") ?? ""),
    offerDescription: String(formData.get("offerDescription") ?? ""),
    targetCustomer: String(formData.get("targetCustomer") ?? ""),
    valueProps: String(formData.get("valueProps") ?? ""),
    commonObjections: String(formData.get("commonObjections") ?? ""),
    avgSalesCycleDays: String(formData.get("avgSalesCycleDays") ?? ""),
  });
  if (!parsed.success) {
    const t = await getTranslations("settings.actions");
    return { error: issueMessage(t, parsed.error.issues[0]?.message, "invalidSettings"), workspace: true };
  }

  const { slackWebhookUrl, removeSlack, ...values } = parsed.data;

  // Switching on what the plan lacks is refused; what was set before stays saved, unused until an upgrade
  const { limits } = await getWorkspacePlan(organization.id);
  const locked: UpgradeReason | null =
    values.autonomy === "AUTOPILOT" && current.autonomy !== "AUTOPILOT" && !limits.autopilot
      ? "autopilot"
      : slackWebhookUrl && !removeSlack && !limits.slack
        ? "slack"
        : values.outboundWebhookUrl && values.outboundWebhookUrl !== current.outboundWebhookUrl && !limits.webhooks
          ? "webhooks"
          : null;
  if (locked) return { ...(await upgradePrompt(locked)), workspace: true };

  // Empty Slack field keeps the saved URL; only "remove" clears it
  const slack = removeSlack ? null : slackWebhookUrl ? encryptSecret(slackWebhookUrl) : current.slackWebhookUrl;
  // A signing secret is created the first time a webhook URL is set
  const webhookSecret =
    values.outboundWebhookUrl && !current.webhookSecret
      ? encryptSecret(randomBytes(24).toString("hex"))
      : current.webhookSecret;

  // The offer stays "guessed from the document" until the seller edits it, not on any save.
  // Textareas post CRLF line breaks: compare without them.
  const same = (a: string | null, b: string | null) =>
    (a ?? "").replace(/\r\n/g, "\n").trim() === (b ?? "").replace(/\r\n/g, "\n").trim();
  const offerEdited =
    !same(values.offerDescription, current.offerDescription) ||
    !same(values.targetCustomer, current.targetCustomer) ||
    !same(values.valueProps, current.valueProps);

  await prisma.workspaceSettings.update({
    where: { organizationId: organization.id },
    data: { ...values, slackWebhookUrl: slack, webhookSecret, ...(offerEdited && { offerInferredFrom: null }) },
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

