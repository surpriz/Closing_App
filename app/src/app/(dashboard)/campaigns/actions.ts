"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import { activateCampaign, archiveCampaign, CAMPAIGN_LOCALES, createCampaign, pauseCampaign } from "@/lib/outreach/campaigns";
import { requireOutreach } from "@/lib/outreach/flag";
import { runOutreachTick } from "@/lib/outreach/tick";
import { testToolsEnabled } from "@/lib/test-tools";

export type ActionResult = { ok: true; notice?: string } | { error: string };

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mailboxId: z.string().min(1).max(64).optional(),
  locale: z.enum(CAMPAIGN_LOCALES).optional(),
});

const idSchema = z.string().min(1).max(64);

/** Creates the draft and opens it: the steps and the import happen on the detail page. */
export async function createCampaignAction(formData: FormData): Promise<{ error: string } | undefined> {
  const { user, organization } = await requireOutreach();
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
  });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${id}`);
}

function refresh(id: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
}

export async function activateCampaignAction(id: string): Promise<ActionResult> {
  const { organization } = await requireOutreach();
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(id).success) return { error: t("invalid") };

  const result = await activateCampaign(organization.id, id);
  if (!result.ok) return { error: t(`issues.${result.issue}`) };
  refresh(id);
  return { ok: true, notice: t("activated") };
}

export async function pauseCampaignAction(id: string): Promise<ActionResult> {
  const { organization } = await requireOutreach();
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(id).success) return { error: t("invalid") };

  if (!(await pauseCampaign(organization.id, id))) return { error: t("notFound") };
  refresh(id);
  return { ok: true, notice: t("paused") };
}

export async function archiveCampaignAction(id: string): Promise<ActionResult> {
  const { organization } = await requireOutreach();
  const t = await getTranslations("campaigns.actions");
  if (!idSchema.safeParse(id).success) return { error: t("invalid") };

  if (!(await archiveCampaign(organization.id, id))) return { error: t("notFound") };
  refresh(id);
  return { ok: true, notice: t("archived") };
}

/** Test environments only: runs a tick on demand instead of waiting for the engine. */
export async function runOutreachTickAction(): Promise<void> {
  const { organization } = await requireOutreach();
  if (!testToolsEnabled()) throw new Error("Test tools are disabled");
  await runOutreachTick(new Date(), { organizationId: organization.id });
  revalidatePath("/campaigns", "layout");
}
