"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { countProspectData, eraseProspectData } from "@/lib/privacy/prospect";
import { accountDeletionBlocker, deleteAccount, deleteWorkspace } from "@/lib/privacy/workspace";
import { isOwnerRole } from "@/lib/roles";
import { requireManager, requireWorkspace } from "@/lib/session";

export type ProspectLookup = Awaited<ReturnType<typeof countProspectData>>;
export type LookupState = { result?: ProspectLookup; error?: string } | null;
export type PrivacyActionState = { ok?: boolean; error?: string } | null;

const emailSchema = z.email();

// Either word works: the page may have been shown in the other language
const CONFIRM_WORDS = ["SUPPRIMER", "DELETE"];

export async function lookupProspect(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const { organization } = await requireManager();
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    const t = await getTranslations("settings.privacyActions");
    return { error: t("invalidEmail") };
  }
  return { result: await countProspectData(organization.id, parsed.data) };
}

export async function eraseProspect(email: string): Promise<PrivacyActionState> {
  const { user, organization } = await requireManager();
  const t = await getTranslations("settings.privacyActions");
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: t("invalidEmail") };

  const result = await eraseProspectData(organization.id, parsed.data);
  if (!result.erased) return { error: t("nothingToErase") };
  // The journal keeps that an erasure happened, never whose
  await logAudit({ organizationId: organization.id, actorUserId: user.id, action: "prospect.erased" });
  revalidatePath("/dashboard");
  revalidatePath("/links");
  return { ok: true };
}

export async function deleteWorkspaceAction(_prev: PrivacyActionState, formData: FormData): Promise<PrivacyActionState> {
  const { user, organization, role } = await requireWorkspace();
  const t = await getTranslations("settings.privacyActions");
  if (!isOwnerRole(role)) return { error: t("ownerOnly") };
  if (String(formData.get("confirm") ?? "").trim() !== organization.name) {
    return { error: t("typeWorkspaceName") };
  }

  await deleteWorkspace(organization.id);
  await logAudit({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "workspace.deleted",
    targetType: "organization",
    targetId: organization.id,
  });
  redirect("/login");
}

export async function deleteAccountAction(_prev: PrivacyActionState, formData: FormData): Promise<PrivacyActionState> {
  const { user, organization } = await requireWorkspace();
  const t = await getTranslations("settings");
  if (!CONFIRM_WORDS.includes(String(formData.get("confirm") ?? "").trim().toUpperCase())) {
    return { error: t("privacyActions.typeConfirmWord", { word: t("privacy.deleteAccountConfirmWord") }) };
  }

  const blocker = await accountDeletionBlocker(user.id);
  if (blocker?.kind === "sole_member") {
    return { error: t("privacyActions.soleMember", { workspace: blocker.workspace }) };
  }
  if (blocker?.kind === "last_owner") {
    return { error: t("privacyActions.lastOwner", { workspace: blocker.workspace }) };
  }

  await deleteAccount(user.id);
  await logAudit({ organizationId: organization.id, actorUserId: null, action: "account.deleted", targetType: "user", targetId: user.id });
  redirect("/login");
}
