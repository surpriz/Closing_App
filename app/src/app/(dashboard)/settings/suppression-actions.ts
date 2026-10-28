"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { requireOutreach } from "@/lib/outreach/flag";
import { addSuppression, removeManualSuppression } from "@/lib/outreach/suppression";

export type SuppressionFormState = { ok: true } | { error: string } | null;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export async function addSuppressionAction(
  _prev: SuppressionFormState,
  formData: FormData,
): Promise<SuppressionFormState> {
  const { user, organization } = await requireOutreach();
  const t = await getTranslations("settings.suppressions.errors");
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: t("invalid") };

  const created = await addSuppression({
    organizationId: organization.id,
    email: parsed.data,
    reason: "MANUAL",
    source: "seller",
  });
  if (!created) return { error: t("exists") };

  await logAudit({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "suppression.added",
    targetType: "suppression",
    metadata: { email: parsed.data },
  });
  revalidatePath("/settings");
  return { ok: true };
}

/** A manual row only: the rows written by an unsubscribe, a bounce or a complaint stay. */
export async function removeSuppressionAction(id: string): Promise<{ ok: true } | { error: string }> {
  const { user, organization } = await requireOutreach();
  const t = await getTranslations("settings.suppressions.errors");
  if (!(await removeManualSuppression(organization.id, id))) return { error: t("notRemovable") };

  await logAudit({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "suppression.removed",
    targetType: "suppression",
    targetId: id,
  });
  revalidatePath("/settings");
  return { ok: true };
}
