"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import { upgradePrompt, type UpgradePrompt } from "@/lib/billing/workspace-plan";
import { findTrackingHint } from "@/lib/closing/ai/guard";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";
import { prisma } from "@/lib/db";
import {
  type Actor,
  activateCampaign,
  archiveCampaign,
  CAMPAIGN_LOCALES,
  canEditCampaign,
  createCampaign,
  pauseCampaign,
  saveSteps,
  updateCampaign,
} from "@/lib/outreach/campaigns";
import {
  enrollForwardedContact,
  importProspects,
  type ImportSummary,
  pauseEnrollment,
  removeEnrollment,
  resendBlockedStep,
  resumeEnrollment,
  skipBlockedStep,
} from "@/lib/outreach/enroll";
import { MAX_IMPORT_BYTES } from "@/lib/outreach/csv";
import { requireOutreach } from "@/lib/outreach/flag";
import { evaluateEnrollmentReading } from "@/lib/outreach/reading";
import { sendTestMessage } from "@/lib/outreach/sender";
import type { StepIssue } from "@/lib/outreach/steps";
import { shiftEnrollmentBack, shiftMailboxRampBack, simulateReading } from "@/lib/outreach/testing";
import { runOutreachTick } from "@/lib/outreach/tick";
import { isManagerRole } from "@/lib/roles";
import { testToolsEnabled } from "@/lib/test-tools";

export type ActionResult = { ok: true; notice?: string } | { error: string } | UpgradePrompt;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mailboxId: z.string().min(1).max(64).optional(),
  locale: z.enum(CAMPAIGN_LOCALES).optional(),
});

const idSchema = z.string().min(1).max(64);

/** Who is acting. Never taken from an argument: it comes from the session. */
function actorOf(workspace: { user: { id: string }; role: string }): Actor {
  return { userId: workspace.user.id, isManager: isManagerRole(workspace.role) };
}

/** Creates the draft and opens it: the steps and the import happen on the detail page. */
export async function createCampaignAction(formData: FormData): Promise<{ error: string } | undefined> {
  const workspace = await requireOutreach();
  const { user, organization } = workspace;
  const t = await getTranslations("campaigns");

  const parsed = createSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    mailboxId: formData.get("mailboxId")?.toString() || undefined,
    locale: formData.get("locale")?.toString() || undefined,
  });
  if (!parsed.success) return { error: t("new.errors.invalid") };

  // Without a choice, the campaign speaks the language of the interface
  const uiLocale = await getLocale();
  const locale = parsed.data.locale ?? (uiLocale === "fr" ? "fr" : "en");
  const { id } = await createCampaign({
    organizationId: organization.id,
    createdById: user.id,
    name: parsed.data.name,
    locale,
    mailboxId: parsed.data.mailboxId ?? null,
    actor: actorOf(workspace),
  });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${id}`);
}

function refresh(id: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
}

export async function activateCampaignAction(id: string): Promise<ActionResult> {
  const workspace = await requireOutreach();
  const { organization } = workspace;
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(id).success) return { error: t("invalid") };

  const result = await activateCampaign(organization.id, id, actorOf(workspace));
  if (!result.ok) {
    if (result.issue === "plan") return await upgradePrompt("mailbox");
    const variables = (result.variables ?? []).map((name) => `{{${name}}}`).join(", ");
    return { error: t(`issues.${result.issue}`, { variables }) };
  }
  refresh(id);
  return { ok: true, notice: t("activated") };
}

export async function pauseCampaignAction(id: string): Promise<ActionResult> {
  const workspace = await requireOutreach();
  const { organization } = workspace;
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(id).success) return { error: t("invalid") };

  if (!(await pauseCampaign(organization.id, id, actorOf(workspace)))) return { error: t("notFound") };
  refresh(id);
  return { ok: true, notice: t("paused") };
}

export async function archiveCampaignAction(id: string): Promise<ActionResult> {
  const workspace = await requireOutreach();
  const { organization } = workspace;
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(id).success) return { error: t("invalid") };

  if (!(await archiveCampaign(organization.id, id, actorOf(workspace)))) return { error: t("notFound") };
  refresh(id);
  return { ok: true, notice: t("archived") };
}

/** Test environments only: runs a tick on demand instead of waiting for the engine. */
export async function runOutreachTickAction(): Promise<string> {
  const { organization } = await requireOutreach();
  if (!testToolsEnabled()) throw new Error("Test tools are disabled");
  const summary = await runOutreachTick(new Date(), { organizationId: organization.id });
  revalidatePath("/campaigns", "layout");
  return JSON.stringify(summary);
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Empty means "leave as is": a mailbox that is no longer ACTIVE cannot be re-saved, only replaced
  mailboxId: z.string().max(64).optional(),
  documentId: z.string().max(64).optional(),
  locale: z.enum(CAMPAIGN_LOCALES),
});

export async function updateCampaignAction(id: string, formData: FormData): Promise<ActionResult> {
  const workspace = await requireOutreach();
  const { organization } = workspace;
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(id).success) return { error: t("invalid") };

  const parsed = updateSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    mailboxId: formData.get("mailboxId")?.toString() ?? "",
    documentId: formData.get("documentId")?.toString() ?? "",
    locale: formData.get("locale")?.toString() ?? "",
  });
  if (!parsed.success) return { error: t("invalidSettings") };

  const ok = await updateCampaign(
    organization.id,
    id,
    {
      name: parsed.data.name,
      locale: parsed.data.locale,
      linkOnReply: formData.get("linkOnReply") === "on",
      ...(parsed.data.mailboxId ? { mailboxId: parsed.data.mailboxId } : {}),
      documentId: parsed.data.documentId || null,
    },
    actorOf(workspace),
  );
  if (!ok) return { error: t("settingsRefused") };
  refresh(id);
  return { ok: true, notice: t("settingsSaved") };
}

const stepsSchema = z
  .array(
    z.object({
      order: z.number().int().min(1).max(50),
      delayDays: z.number().int().min(0).max(365),
      subject: z.string().max(1000).nullable(),
      newThread: z.boolean(),
      body: z.string().max(20_000),
      carriesLink: z.boolean(),
    }),
  )
  .max(50);

export type SaveStepsResult = { ok: true; notice: string } | { error: string; issues?: string[] };

export async function saveStepsAction(id: string, stepsJson: string): Promise<SaveStepsResult> {
  const workspace = await requireOutreach();
  const { organization } = workspace;
  const t = await getTranslations("campaigns");
  if (!idSchema.safeParse(id).success) return { error: t("actions.invalid") };

  let raw: unknown;
  try {
    raw = JSON.parse(stepsJson);
  } catch {
    return { error: t("actions.invalid") };
  }
  const parsed = stepsSchema.safeParse(raw);
  if (!parsed.success) return { error: t("actions.invalid") };

  const result = await saveSteps(organization.id, id, parsed.data, actorOf(workspace));
  if (!result.ok) {
    if (result.issues.length === 0) return { error: t("actions.notFound") };
    const label = (issue: StepIssue) => t(`steps.issues.${issue.code}`, { order: "order" in issue ? issue.order : 0 });
    return { error: t("steps.issues.summary"), issues: result.issues.map(label) };
  }
  refresh(id);
  return { ok: true, notice: t("steps.saved") };
}

/** The editor warns while typing; the check lives server side because the guard pulls in the whole message catalog. */
export async function trackingHintAction(text: string): Promise<string | null> {
  await requireOutreach();
  const parsed = z.string().max(20_000).safeParse(text);
  return parsed.success ? findTrackingHint(parsed.data) : null;
}

export async function importProspectsAction(
  id: string,
  formData: FormData,
): Promise<ImportSummary | { error: string }> {
  const workspace = await requireOutreach();
  const { user, organization } = workspace;
  const t = await getTranslations("campaigns");
  if (!idSchema.safeParse(id).success) return { error: t("actions.invalid") };

  const csv = formData.get("csv")?.toString() ?? "";
  if (Buffer.byteLength(csv, "utf8") > MAX_IMPORT_BYTES) return { error: t("import.errors.tooBig") };

  const prefs = await getSellerPrefs(user.id, organization.id);
  const result = await importProspects({
    organizationId: organization.id,
    campaignId: id,
    csv,
    sellerTimezone: sellerTimezone(prefs),
    actor: actorOf(workspace),
  });
  if ("error" in result) return { error: t(`import.errors.${result.error}`) };
  refresh(id);
  return result;
}

async function enrollmentAction(
  enrollmentId: string,
  run: (organizationId: string, id: string, now: Date, actor: Actor) => Promise<boolean>,
  notice: "enrollmentPaused" | "enrollmentResumed" | "enrollmentRemoved" | "stepResent" | "stepSkipped",
): Promise<ActionResult> {
  const workspace = await requireOutreach();
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(enrollmentId).success) return { error: t("invalid") };

  // The helpers check the workspace and the campaign's creator themselves; a foreign id simply matches nothing
  if (!(await run(workspace.organization.id, enrollmentId, new Date(), actorOf(workspace)))) return { error: t("enrollmentUnchanged") };
  revalidatePath("/campaigns", "layout");
  return { ok: true, notice: t(notice) };
}

export async function pauseEnrollmentAction(enrollmentId: string): Promise<ActionResult> {
  return enrollmentAction(enrollmentId, pauseEnrollment, "enrollmentPaused");
}

export async function resumeEnrollmentAction(enrollmentId: string): Promise<ActionResult> {
  return enrollmentAction(enrollmentId, resumeEnrollment, "enrollmentResumed");
}

export async function resendStepAction(enrollmentId: string): Promise<ActionResult> {
  return enrollmentAction(enrollmentId, (organizationId, id, now, actor) => resendBlockedStep(organizationId, id, actor, now), "stepResent");
}

export async function skipStepAction(enrollmentId: string): Promise<ActionResult> {
  return enrollmentAction(enrollmentId, (organizationId, id, now, actor) => skipBlockedStep(organizationId, id, actor, now), "stepSkipped");
}

export async function removeEnrollmentAction(enrollmentId: string): Promise<ActionResult> {
  return enrollmentAction(enrollmentId, removeEnrollment, "enrollmentRemoved");
}

/** Sends the step to the signed-in seller only, never to a prospect. */
export async function sendTestAction(campaignId: string, stepOrder: number): Promise<ActionResult> {
  const workspace = await requireOutreach();
  const { user, organization } = workspace;
  const t = await getTranslations("campaigns");
  if (!idSchema.safeParse(campaignId).success || !Number.isInteger(stepOrder)) return { error: t("actions.invalid") };
  const own = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId: organization.id },
    select: { createdById: true },
  });
  if (!own || !canEditCampaign(own, actorOf(workspace))) return { error: t("steps.test.not_found") };

  const result = await sendTestMessage({
    organizationId: organization.id,
    campaignId,
    stepOrder,
    to: user.email,
  });
  if (!result.ok) {
    const known = ["not_found", "no_mailbox", "cap"] as const;
    const message = (known as readonly string[]).includes(result.code)
      ? t(`steps.test.${result.code as (typeof known)[number]}`)
      : t(`errors.${result.code as "TRANSIENT"}`);
    return { error: message };
  }
  return { ok: true, notice: t("steps.test.sent", { email: user.email }) };
}

const daysSchema = z.number().int().min(1).max(60);

/** Test environments only. */
export async function timeTravelEnrollmentAction(enrollmentId: string, days: number): Promise<ActionResult> {
  const workspace = await requireOutreach();
  if (!testToolsEnabled()) throw new Error("Test tools are disabled");
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(enrollmentId).success || !daysSchema.safeParse(days).success) return { error: t("invalid") };

  const own = await prisma.campaignProspect.findFirst({
    where: { id: enrollmentId, organizationId: workspace.organization.id },
    select: { id: true, campaign: { select: { createdById: true } } },
  });
  if (!own || !canEditCampaign(own.campaign, actorOf(workspace))) return { error: t("invalid") };
  await shiftEnrollmentBack(own.id, days);
  revalidatePath("/campaigns", "layout");
  return { ok: true, notice: t("shifted") };
}

/** Test environments only. */
export async function shiftMailboxRampAction(mailboxId: string, days: number): Promise<ActionResult> {
  const workspace = await requireOutreach();
  if (!testToolsEnabled()) throw new Error("Test tools are disabled");
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(mailboxId).success || !daysSchema.safeParse(days).success) return { error: t("invalid") };

  const actor = actorOf(workspace);
  const own = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: workspace.organization.id, ...(actor.isManager ? {} : { userId: actor.userId }) },
    select: { id: true },
  });
  if (!own) return { error: t("invalid") };
  await shiftMailboxRampBack(own.id, days);
  revalidatePath("/campaigns", "layout");
  return { ok: true, notice: t("shifted") };
}

/** E8: the seller adds, by hand, a contact the prospect forwarded the document to. */
export async function addForwardedContactAction(campaignId: string, prospectId: string): Promise<ActionResult> {
  const workspace = await requireOutreach();
  const t = await getTranslations("campaigns.forwarded");
  if (!idSchema.safeParse(campaignId).success || !idSchema.safeParse(prospectId).success) return { error: t("invalid") };

  const result = await enrollForwardedContact(
    campaignId,
    prospectId,
    actorOf(workspace),
    new Date(),
    workspace.organization.id,
  );
  if (result !== "enrolled") return { error: t(result) };
  refresh(campaignId);
  return { ok: true, notice: t("added") };
}

const secondsSchema = z.number().int().min(0).max(3600);

/** The enrollment belongs to the workspace, and the actor may edit its campaign. */
async function ownEnrollment(organizationId: string, enrollmentId: string, actor: Actor) {
  const own = await prisma.campaignProspect.findFirst({
    where: { id: enrollmentId, organizationId },
    select: { id: true, linkId: true, campaign: { select: { createdById: true } } },
  });
  return own && canEditCampaign(own.campaign, actor) ? own : null;
}

/** Test environments only: records a reading on the enrollment's link. */
export async function simulateReadingAction(
  enrollmentId: string,
  pricingSeconds: number,
  totalSeconds: number,
): Promise<ActionResult> {
  const workspace = await requireOutreach();
  if (!testToolsEnabled()) throw new Error("Test tools are disabled");
  const t = await getTranslations("campaigns.actions");
  if (
    !idSchema.safeParse(enrollmentId).success ||
    !secondsSchema.safeParse(pricingSeconds).success ||
    !secondsSchema.safeParse(totalSeconds).success
  ) {
    return { error: t("invalid") };
  }
  const own = await ownEnrollment(workspace.organization.id, enrollmentId, actorOf(workspace));
  if (!own) return { error: t("invalid") };
  if (!(await simulateReading(own.id, { pricingSeconds, totalSeconds }))) return { error: t("noLink") };
  revalidatePath("/campaigns", "layout");
  return { ok: true, notice: t("readingSimulated") };
}

/** Test environments only: runs the reading evaluation now and says what it decided. */
export async function evaluateReadingAction(enrollmentId: string): Promise<ActionResult> {
  const workspace = await requireOutreach();
  if (!testToolsEnabled()) throw new Error("Test tools are disabled");
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(enrollmentId).success) return { error: t("invalid") };
  const own = await ownEnrollment(workspace.organization.id, enrollmentId, actorOf(workspace));
  if (!own) return { error: t("invalid") };
  if (!own.linkId) return { error: t("noLink") };

  const kind = await evaluateEnrollmentReading(own.linkId, new Date());
  revalidatePath("/campaigns", "layout");
  return { ok: true, notice: t("readingEvaluated", { kind: kind ?? "none" }) };
}
