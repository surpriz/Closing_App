"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { countProspectData, eraseProspectData } from "@/lib/privacy/prospect";
import { accountDeletionBlocker, deleteAccount, deleteWorkspace } from "@/lib/privacy/workspace";
import { isOwnerRole } from "@/lib/roles";
import { requireManager, requireWorkspace } from "@/lib/session";

export type ProspectLookup = Awaited<ReturnType<typeof countProspectData>>;
export type LookupState = { result?: ProspectLookup; error?: string } | null;
export type PrivacyActionState = { ok?: boolean; error?: string } | null;

const emailSchema = z.email("Adresse email invalide.");

export async function lookupProspect(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const { organization } = await requireManager();
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  return { result: await countProspectData(organization.id, parsed.data) };
}

export async function eraseProspect(email: string): Promise<PrivacyActionState> {
  const { organization } = await requireManager();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "Adresse email invalide." };

  const result = await eraseProspectData(organization.id, parsed.data);
  if (!result.erased) return { error: "Rien à supprimer pour cette adresse." };
  revalidatePath("/dashboard");
  revalidatePath("/links");
  return { ok: true };
}

export async function deleteWorkspaceAction(_prev: PrivacyActionState, formData: FormData): Promise<PrivacyActionState> {
  const { organization, role } = await requireWorkspace();
  if (!isOwnerRole(role)) return { error: "Seul un propriétaire peut supprimer l'espace." };
  if (String(formData.get("confirm") ?? "").trim() !== organization.name) {
    return { error: "Tapez le nom exact de l'espace pour confirmer." };
  }

  await deleteWorkspace(organization.id);
  redirect("/login");
}

export async function deleteAccountAction(_prev: PrivacyActionState, formData: FormData): Promise<PrivacyActionState> {
  const { user } = await requireWorkspace();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "SUPPRIMER") {
    return { error: "Tapez SUPPRIMER pour confirmer." };
  }

  const blocker = await accountDeletionBlocker(user.id);
  if (blocker?.kind === "sole_member") {
    return { error: `Vous êtes seul dans « ${blocker.workspace} » : supprimez l'espace à la place.` };
  }
  if (blocker?.kind === "last_owner") {
    return { error: `Nommez un autre propriétaire de « ${blocker.workspace} » avant de partir.` };
  }

  await deleteAccount(user.id);
  redirect("/login");
}
