"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { getAppOrigin } from "@/lib/app-origin";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { devMagicLinksEnabled } from "@/lib/dev-magic-links";
import { requireManager } from "@/lib/session";
import { teamErrorMessage } from "@/lib/team-errors";

/**
 * Inviting, promoting and removing teammates. Better Auth enforces who may do
 * what (only an owner hands out "owner", the last owner stays); the workspace
 * is always passed explicitly since sessions created before teams have no
 * active organization.
 */

export type TeamActionState = { ok?: boolean; error?: string; devUrl?: string } | null;

const inviteSchema = z.object({
  email: z.email("Adresse email invalide.").transform((email) => email.toLowerCase()),
  role: z.enum(["member", "admin"]),
});

const roleSchema = z.enum(["member", "admin", "owner"]);

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/equipe");
}

export async function inviteMember(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const { organization } = await requireManager();
  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    role: String(formData.get("role") ?? "member"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invitation invalide." };

  try {
    const invitation = await auth.api.createInvitation({
      body: { ...parsed.data, organizationId: organization.id },
      headers: await headers(),
    });
    refresh();
    // No email in local dev: the link is shown to copy instead
    return devMagicLinksEnabled()
      ? { ok: true, devUrl: `${await getAppOrigin()}/invitation/${invitation.id}` }
      : { ok: true };
  } catch (error) {
    return { error: teamErrorMessage(error, "Invitation impossible, réessayez.") };
  }
}

export async function cancelInvitation(invitationId: string): Promise<TeamActionState> {
  await requireManager();
  try {
    await auth.api.cancelInvitation({ body: { invitationId }, headers: await headers() });
  } catch (error) {
    return { error: teamErrorMessage(error) };
  }
  refresh();
  return { ok: true };
}

export async function updateMemberRole(memberId: string, role: string): Promise<TeamActionState> {
  const { organization } = await requireManager();
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { error: "Rôle inconnu." };

  try {
    await auth.api.updateMemberRole({
      body: { memberId, role: parsed.data, organizationId: organization.id },
      headers: await headers(),
    });
  } catch (error) {
    return { error: teamErrorMessage(error) };
  }
  refresh();
  return { ok: true };
}

export async function removeMember(memberId: string): Promise<TeamActionState> {
  const { organization } = await requireManager();
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: organization.id },
    select: { userId: true },
  });
  if (!member) return { error: "Ce membre n'est plus dans l'équipe." };

  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: organization.id },
      headers: await headers(),
    });
  } catch (error) {
    return { error: teamErrorMessage(error) };
  }
  // Their deals go back to the owner, like links nobody created
  await prisma.link.updateMany({
    where: { organizationId: organization.id, createdById: member.userId },
    data: { createdById: null },
  });
  refresh();
  return { ok: true };
}
